const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createPoolFromEnv } = require('./mysql-utils');

const REPORTS_DIR = process.env.SITE_ICON_REPORTS_DIR
  ? path.resolve(process.env.SITE_ICON_REPORTS_DIR)
  : path.join(process.cwd(), 'storage', 'reports', 'site-icons');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseArgs(argv) {
  const options = {
    batchSize: 300,
    concurrency: 8,
    pauseMs: 1000,
    regions: ['china', 'overseas'],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--batch-size') options.batchSize = Number(argv[++index] || options.batchSize);
    else if (arg === '--concurrency') options.concurrency = Number(argv[++index] || options.concurrency);
    else if (arg === '--pause-ms') options.pauseMs = Number(argv[++index] || options.pauseMs);
    else if (arg === '--regions') {
      options.regions = String(argv[++index] || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  options.batchSize = Math.max(1, options.batchSize || 300);
  options.concurrency = Math.max(1, Math.min(16, options.concurrency || 8));
  options.pauseMs = Math.max(0, options.pauseMs || 1000);
  options.regions = options.regions.filter((region) => ['china', 'overseas'].includes(region));
  if (!options.regions.length) {
    throw new Error('No valid regions provided. Use china and/or overseas.');
  }

  return options;
}

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

const options = parseArgs(process.argv.slice(2));
ensureDir(REPORTS_DIR);

const logFile = path.join(REPORTS_DIR, `${formatTimestamp()}-site-icons-queue.log`);

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, `${line}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPendingCount(pool, region) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM websites
     WHERE status = 'active'
       AND region = ?
       AND normalized_domain IS NOT NULL
       AND normalized_domain <> ''
       AND (icon_fetch_status IS NULL OR icon_fetch_status = '' OR icon_fetch_status = 'pending')`,
    [region]
  );
  return Number(rows[0]?.count || 0);
}

async function getRegionStats(pool, region) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN icon_fetch_status = 'success' THEN 1 ELSE 0 END) AS success_count,
            SUM(CASE WHEN icon_fetch_status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
            SUM(CASE WHEN icon_fetch_status IS NULL THEN 1 ELSE 0 END) AS pending_count
     FROM websites
     WHERE region = ?`,
    [region]
  );
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    success: Number(row.success_count || 0),
    failed: Number(row.failed_count || 0),
    pending: Number(row.pending_count || 0),
  };
}

function runOneBatch(region) {
  const args = [
    path.join(__dirname, 'fetch-site-icons.js'),
    '--limit', String(options.batchSize),
    '--offset', '0',
    '--concurrency', String(options.concurrency),
    '--region', region,
  ];

  log(`start batch region=${region} batchSize=${options.batchSize} concurrency=${options.concurrency}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.stdout) {
    const stdoutText = result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`;
    fs.appendFileSync(logFile, stdoutText);
  }
  if (result.stderr) {
    const stderrText = result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`;
    fs.appendFileSync(logFile, stderrText);
  }

  if (result.status !== 0) {
    log(`batch failed region=${region} exit=${result.status}`);
    return false;
  }

  log(`batch completed region=${region}`);
  return true;
}

async function main() {
  const pool = createPoolFromEnv();
  try {
    log(`queue started regions=${options.regions.join(',')} batchSize=${options.batchSize} concurrency=${options.concurrency} logFile=${logFile}`);

    while (true) {
      let ranAnyBatch = false;

      for (const region of options.regions) {
        const pending = await getPendingCount(pool, region);
        if (pending <= 0) {
          const stats = await getRegionStats(pool, region);
          log(`region=${region} done total=${stats.total} success=${stats.success} failed=${stats.failed} pending=${stats.pending}`);
          continue;
        }

        log(`region=${region} pending=${pending}`);
        const ok = runOneBatch(region);
        ranAnyBatch = true;
        if (!ok) {
          await sleep(Math.max(options.pauseMs, 5000));
        } else {
          await sleep(options.pauseMs);
        }
      }

      const pendingCounts = await Promise.all(options.regions.map((region) => getPendingCount(pool, region)));
      const totalPending = pendingCounts.reduce((sum, value) => sum + value, 0);
      log(`cycle summary pending=${totalPending} detail=${options.regions.map((region, index) => `${region}:${pendingCounts[index]}`).join(', ')}`);

      if (totalPending <= 0) {
        log('all pending queues finished.');
        break;
      }

      if (!ranAnyBatch) {
        await sleep(Math.max(options.pauseMs, 5000));
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  log(`queue failed: ${error && error.stack ? error.stack : error}`);
  process.exitCode = 1;
});
