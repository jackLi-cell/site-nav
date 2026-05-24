/**
 * Compatibility entry for older seed instructions.
 *
 * The authoritative catalog seed path is now:
 *   websites-import.csv + supplemental snapshots/json
 *   -> scripts/build-seed-sql.js
 *   -> drizzle-mysql/import-websites-chunks/*.sql
 *   -> scripts/apply-seed-sql.js
 *
 * This wrapper keeps historic `node scripts/seed-mysql.js` commands working
 * without bypassing the repeatable SQL chunk pipeline.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(process.execPath, [path.join(__dirname, 'apply-seed-sql.js'), ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

process.exitCode = result.status || 0;
