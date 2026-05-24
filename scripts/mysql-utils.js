const mysql = require('mysql2/promise');
const { loadDotEnv } = require('./env-utils');

loadDotEnv();

function parseMysqlUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (!['mysql:', 'mysql2:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported database protocol: ${parsed.protocol}`);
  }

  const database = parsed.pathname.replace(/^\/+/, '');
  if (!parsed.hostname || !parsed.username || !database) {
    throw new Error('DATABASE_URL is missing host, username or database name');
  }

  const port = parsed.port ? Number(parsed.port) : 3306;
  const sslParam = parsed.searchParams.get('ssl');
  const ssl = sslParam && sslParam !== 'false'
    ? { rejectUnauthorized: false }
    : undefined;

  return {
    host: parsed.hostname,
    port,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(database),
    ssl,
  };
}

function resolveMysqlConfig(env = process.env) {
  const directUrl = env.DATABASE_URL?.trim() || env.MYSQL_URL?.trim();
  if (directUrl) {
    return parseMysqlUrl(directUrl);
  }

  const host = env.MYSQL_HOST?.trim();
  const user = env.MYSQL_USER?.trim();
  const password = env.MYSQL_PASSWORD ?? '';
  const database = env.MYSQL_DATABASE?.trim();

  if (!host || !user || !database) {
    return null;
  }

  const port = Number(env.MYSQL_PORT || '3306');
  const sslEnabled = ['1', 'true', 'yes'].includes((env.MYSQL_SSL || '').toLowerCase());

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  };
}

function createPoolFromEnv(env = process.env) {
  const config = resolveMysqlConfig(env);
  if (!config) {
    throw new Error('MySQL is not configured. Set DATABASE_URL or MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE.');
  }

  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(env.MYSQL_POOL_SIZE || '10'),
    maxIdle: Number(env.MYSQL_POOL_MAX_IDLE || '5'),
    idleTimeout: Number(env.MYSQL_POOL_IDLE_TIMEOUT || '60000'),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: 'Z',
  });
}

module.exports = {
  parseMysqlUrl,
  resolveMysqlConfig,
  createPoolFromEnv,
};
