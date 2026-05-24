import mysql, { type Pool, type ResultSetHeader } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema';

type BaseDatabase = MySql2Database<typeof schema>;

export type Database = BaseDatabase & {
  all<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ results: T[] }>;
  run(query: string, params?: unknown[]): Promise<ResultSetHeader>;
};

declare global {
  // eslint-disable-next-line no-var
  var __siteNavDb: Database | undefined;
  // eslint-disable-next-line no-var
  var __siteNavPool: Pool | undefined;
}

function parseMysqlUrl(databaseUrl: string) {
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

function resolveMysqlConfig() {
  const directUrl = process.env.DATABASE_URL?.trim() || process.env.MYSQL_URL?.trim();
  if (directUrl) {
    return parseMysqlUrl(directUrl);
  }

  const host = process.env.MYSQL_HOST?.trim();
  const user = process.env.MYSQL_USER?.trim();
  const password = process.env.MYSQL_PASSWORD ?? '';
  const database = process.env.MYSQL_DATABASE?.trim();

  if (!host || !user || !database) {
    return null;
  }

  const port = Number(process.env.MYSQL_PORT || '3306');
  const sslEnabled = ['1', 'true', 'yes'].includes((process.env.MYSQL_SSL || '').toLowerCase());

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  };
}

function createPool(): Pool {
  const config = resolveMysqlConfig();
  if (!config) {
    throw new Error(
      'MySQL is not configured. Set DATABASE_URL or MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE.'
    );
  }

  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || '10'),
    maxIdle: Number(process.env.MYSQL_POOL_MAX_IDLE || '5'),
    idleTimeout: Number(process.env.MYSQL_POOL_IDLE_TIMEOUT || '60000'),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: 'Z',
  });
}

export function hasDatabaseConfig() {
  return resolveMysqlConfig() !== null;
}

export function getPool() {
  if (!globalThis.__siteNavPool) {
    globalThis.__siteNavPool = createPool();
  }
  return globalThis.__siteNavPool;
}

export function getDb(_legacyBinding?: unknown): Database {
  if (!globalThis.__siteNavDb) {
    const pool = getPool();
    const db = drizzle(pool, { schema, mode: 'default' }) as Database;

    db.all = async <T = Record<string, unknown>>(query: string, params: unknown[] = []) => {
      const [rows] = await pool.query(query, params as never[]);
      return { results: rows as T[] };
    };

    db.run = async (query: string, params: unknown[] = []) => {
      const [result] = await pool.execute<ResultSetHeader>(query, params as never[]);
      return result;
    };

    globalThis.__siteNavDb = db;
  }

  return globalThis.__siteNavDb;
}
