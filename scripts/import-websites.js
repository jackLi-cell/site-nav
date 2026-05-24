/**
 * Compatibility entry for the catalog import.
 *
 * The authoritative import path is now:
 *   websites-import.csv + supplemental snapshots/json
 *   -> scripts/build-seed-sql.js
 *   -> drizzle-mysql/import-websites-chunks/*.sql
 *   -> scripts/apply-seed-sql.js
 *
 * Keeping this file lets old commands such as `npm run data:import` continue
 * to work without bypassing the repeatable SQL chunk pipeline.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(process.execPath, [path.join(__dirname, 'apply-seed-sql.js'), ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

process.exitCode = result.status || 0;
