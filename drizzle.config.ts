import type { Config } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    const value = match[2].trim();
    process.env[match[1]] = value.replace(/^["']|["']$/g, '');
  }
}

loadEnvFile();

export default {
  schema: './src/db/schema.ts',
  out: './drizzle-mysql',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://site_nav:site_nav_password@127.0.0.1:3306/site_nav',
  },
} satisfies Config;
