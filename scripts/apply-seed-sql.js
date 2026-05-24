/**
 * Apply generated MySQL seed SQL chunks in manifest order.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createPoolFromEnv } = require('./mysql-utils');

const ROOT = path.join(__dirname, '..');
const CHUNK_DIR = path.join(ROOT, 'drizzle-mysql/import-websites-chunks');
const MANIFEST_FILE = path.join(CHUNK_DIR, 'manifest.json');
const SHOULD_SKIP_BUILD = process.argv.includes('--skip-build') || process.env.SEED_SQL_SKIP_BUILD === '1';

function runNodeScript(scriptName) {
  const result = spawnSync(process.execPath, [path.join(__dirname, scriptName)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status}`);
  }
}

async function tableCount(pool, table) {
  const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  return Number(rows[0]?.count || 0);
}

async function main() {
  if (!SHOULD_SKIP_BUILD || !fs.existsSync(MANIFEST_FILE)) {
    console.log('[apply-seed-sql] building SQL chunks first...');
    runNodeScript('build-seed-sql.js');
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const pool = createPoolFromEnv();

  try {
    await pool.query('SET SESSION wait_timeout=28800');
    await pool.query('SET SESSION net_write_timeout=28800');

    let applied = 0;
    for (const item of manifest.files) {
      const filePath = path.join(CHUNK_DIR, item.file);
      if (item.table === 'reset') {
        await pool.query('SET FOREIGN_KEY_CHECKS=0');
        for (const table of [
          'website_tags',
          'website_keywords',
          'website_categories',
          'websites',
          'tags',
          'keywords',
          'categories',
        ]) {
          await pool.query(`TRUNCATE TABLE \`${table}\``);
        }
        await pool.query('SET FOREIGN_KEY_CHECKS=1');
      } else {
        const sql = fs.readFileSync(filePath, 'utf8');
        await pool.query(sql);
      }
      applied += 1;
      if (applied % 25 === 0 || applied === manifest.files.length) {
        console.log(`[apply-seed-sql] applied ${applied}/${manifest.files.length}: ${item.file}`);
      }
    }

    const counts = {
      categories: await tableCount(pool, 'categories'),
      tags: await tableCount(pool, 'tags'),
      keywords: await tableCount(pool, 'keywords'),
      websites: await tableCount(pool, 'websites'),
      website_categories: await tableCount(pool, 'website_categories'),
      website_keywords: await tableCount(pool, 'website_keywords'),
      website_tags: await tableCount(pool, 'website_tags'),
    };

    console.log('[apply-seed-sql] database counts:');
    console.log(JSON.stringify(counts, null, 2));

    if (counts.websites < manifest.counts.websites) {
      throw new Error(`Website count mismatch: DB ${counts.websites}, manifest ${manifest.counts.websites}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[apply-seed-sql] failed:', error);
  process.exitCode = 1;
});
