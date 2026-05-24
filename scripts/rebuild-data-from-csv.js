/**
 * Legacy compatibility entry.
 *
 * The authoritative pipeline is now:
 *   data/websites-import.csv + fallback snapshots/json
 *   -> scripts/build-seed-sql.js
 *   -> drizzle-mysql/import-websites-chunks/*.sql
 *   -> scripts/apply-seed-sql.js / db:init
 *
 * This wrapper preserves the historic command name while redirecting to the
 * SQL chunk generator, so nobody can accidentally regenerate the old JSON-only
 * export path.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(process.execPath, [path.join(__dirname, 'build-seed-sql.js'), ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

process.exitCode = result.status || 0;
