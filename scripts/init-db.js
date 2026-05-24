const crypto = require('crypto');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const { loadDotEnv } = require('./env-utils');
const { parseMysqlUrl, resolveMysqlConfig } = require('./mysql-utils');

loadDotEnv();

const SHOULD_IMPORT = process.argv.includes('--import');

function quoteIdentifier(value) {
  if (!/^[A-Za-z0-9_$]+$/.test(value)) {
    throw new Error(`Unsafe MySQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function resolveAccountHosts(target) {
  if (['127.0.0.1', 'localhost', '::1'].includes(target.host)) {
    return ['localhost', '127.0.0.1'];
  }
  return ['%'];
}

function shellCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function resolveAdminConfig(target) {
  const adminUrl = process.env.MYSQL_ADMIN_URL || process.env.MYSQL_ROOT_URL;
  if (adminUrl) {
    return parseMysqlUrl(adminUrl);
  }

  const user = process.env.MYSQL_ADMIN_USER || process.env.MYSQL_ROOT_USER || 'root';
  const password = process.env.MYSQL_ADMIN_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
  return {
    host: target.host,
    port: target.port,
    user,
    password,
    database: 'mysql',
    ssl: target.ssl,
  };
}

async function withConnection(config, fn) {
  const connection = await mysql.createConnection({
    ...config,
    multipleStatements: false,
  });
  try {
    return await fn(connection);
  } finally {
    await connection.end();
  }
}

async function ensureDatabaseAndUser(target) {
  const adminConfig = resolveAdminConfig(target);
  let adminConnected = false;

  try {
    await withConnection(adminConfig, async (connection) => {
      adminConnected = true;
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(target.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
      );

      if (adminConfig.user !== target.user && target.user) {
        for (const host of resolveAccountHosts(target)) {
          const account = `${connection.escape(target.user)}@${connection.escape(host)}`;
          await connection.query(
            `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${connection.escape(target.password || '')}`
          );
          await connection.query(`GRANT ALL PRIVILEGES ON ${quoteIdentifier(target.database)}.* TO ${account}`);
        }
      }
    });
  } catch (error) {
    console.warn(`[db:init] Admin connection failed: ${error.message}`);
  }

  if (!adminConnected) {
    console.warn('[db:init] Falling back to target DATABASE_URL user. It must already have permission and database must exist.');
  }

  await withConnection({ ...target, database: target.database }, async (connection) => {
    await connection.query('SELECT 1');
  });
}

async function createDefaultAdmin(target) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    return;
  }

  const id = `admin_${crypto.createHash('sha1').update(email).digest('hex').slice(0, 24)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  const now = new Date().toISOString();

  await withConnection(target, async (connection) => {
    await connection.query(
      `INSERT INTO users (id, email, email_verified, password_hash, name, role, contribution_score, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, 'admin', 0, ?, ?)
       ON DUPLICATE KEY UPDATE role='admin', updated_at=VALUES(updated_at)`,
      [id, email, `${salt}:${hash}`, email.split('@')[0], now, now]
    );
  });

  console.log(`[db:init] Admin user ensured: ${email}`);
}

async function main() {
  const target = resolveMysqlConfig(process.env);
  if (!target) {
    throw new Error('Missing database config. Set DATABASE_URL or MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE.');
  }

  console.log(`[db:init] Target MySQL: ${target.user}@${target.host}:${target.port}/${target.database}`);
  await ensureDatabaseAndUser(target);

  console.log('[db:init] Applying schema with drizzle-kit push...');
  shellCommand('npx', ['drizzle-kit', 'push']);

  console.log('[db:init] Building and applying catalog seed SQL...');
  shellCommand('node', ['scripts/apply-seed-sql.js']);

  await createDefaultAdmin(target);

  if (SHOULD_IMPORT) {
    console.log('[db:init] Full CSV import is already handled by scripts/apply-seed-sql.js.');
  } else {
    console.log('[db:init] Catalog seed SQL applied. Use --import only as a compatibility flag.');
  }

  console.log('[db:init] Done.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
