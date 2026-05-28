const fs = require('fs');
const path = require('path');
const { createPoolFromEnv } = require('./mysql-utils');

const REPORTS_DIR = process.env.SITE_ICON_REPORTS_DIR
  ? path.resolve(process.env.SITE_ICON_REPORTS_DIR)
  : path.join(process.cwd(), 'storage', 'reports', 'site-icons');

function escapeSqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
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

function parseArgs(argv) {
  const options = { region: 'all', batchSize: 5000 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--region') options.region = String(argv[++i] || 'all').trim().toLowerCase();
    else if (argv[i] === '--batch-size') options.batchSize = Number(argv[++i] || 5000);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const pool = createPoolFromEnv();
  try {
    const where = [`icon_fetch_status IS NOT NULL`, `icon_fetch_status <> ''`, `icon_fetch_status <> 'pending'`];
    const params = [];
    if (options.region !== 'all') {
      where.push('region = ?');
      params.push(options.region);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM websites WHERE ${where.join(' AND ')}`,
      params
    );
    const total = Number(countRows[0].total);
    console.log(`[export] total records to export: ${total} (region=${options.region})`);

    if (total === 0) {
      console.log('[export] nothing to export.');
      return;
    }

    const stamp = formatTimestamp();
    const regionSuffix = options.region === 'all' ? 'all' : options.region;
    const outputPath = path.join(REPORTS_DIR, `${stamp}-icon-field-updates-${regionSuffix}.sql`);
    const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

    stream.write(`-- Icon field updates exported from local DB\n`);
    stream.write(`-- Created: ${new Date().toISOString()}\n`);
    stream.write(`-- Region: ${options.region}\n`);
    stream.write(`-- Total records: ${total}\n`);
    stream.write(`-- Apply to production DB after backing up.\n\n`);
    stream.write(`SET NAMES utf8mb4;\n`);
    stream.write(`START TRANSACTION;\n\n`);

    let offset = 0;
    let written = 0;

    while (offset < total) {
      const [rows] = await pool.query(
        `SELECT id, icon_path, icon_source_url, icon_mime_type, icon_fetch_status, icon_fetched_at, updated_at
         FROM websites
         WHERE ${where.join(' AND ')}
         ORDER BY id
         LIMIT ? OFFSET ?`,
        [...params, options.batchSize, offset]
      );

      if (!rows.length) break;

      for (const row of rows) {
        const iconPath = row.icon_path ? escapeSqlString(row.icon_path) : 'NULL';
        const iconSourceUrl = row.icon_source_url ? escapeSqlString(row.icon_source_url) : 'NULL';
        const iconMimeType = row.icon_mime_type ? escapeSqlString(row.icon_mime_type) : 'NULL';
        const iconFetchStatus = escapeSqlString(row.icon_fetch_status);
        const iconFetchedAt = row.icon_fetched_at ? escapeSqlString(row.icon_fetched_at) : 'NULL';
        const updatedAt = row.updated_at ? escapeSqlString(row.updated_at) : 'NOW()';
        const id = escapeSqlString(row.id);

        stream.write(
          `UPDATE websites SET icon_path=${iconPath}, icon_source_url=${iconSourceUrl}, icon_mime_type=${iconMimeType}, icon_fetch_status=${iconFetchStatus}, icon_fetched_at=${iconFetchedAt}, updated_at=${updatedAt} WHERE id=${id};\n`
        );
        written++;
      }

      offset += rows.length;
      if (offset % 20000 === 0 || offset >= total) {
        console.log(`[export] progress: ${offset}/${total}`);
      }
    }

    stream.write(`\nCOMMIT;\n`);
    stream.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    console.log(`[export] done. Written ${written} UPDATE statements.`);
    console.log(`[export] output: ${outputPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[export] failed:', error);
  process.exitCode = 1;
});
