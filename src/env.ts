export interface AppEnv {
  DATABASE_URL?: string;
  MYSQL_URL?: string;
  MYSQL_HOST?: string;
  MYSQL_PORT?: string;
  MYSQL_USER?: string;
  MYSQL_PASSWORD?: string;
  MYSQL_DATABASE?: string;
  MYSQL_SSL?: string;
  MYSQL_POOL_SIZE?: string;
  MYSQL_POOL_MAX_IDLE?: string;
  MYSQL_POOL_IDLE_TIMEOUT?: string;
  AUTH_SECRET: string;
  APP_URL: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}
