const { createPoolFromEnv } = require('./mysql-utils');

const INDEXES = [
  {
    table: 'websites',
    name: 'idx_websites_public_rank',
    sql: 'CREATE INDEX idx_websites_public_rank ON websites (status, region, view_count DESC, name ASC, id)',
  },
  {
    table: 'websites',
    name: 'idx_websites_public_latest',
    sql: 'CREATE INDEX idx_websites_public_latest ON websites (status, region, created_at DESC, id)',
  },
  {
    table: 'website_categories',
    name: 'idx_wc_category_website',
    sql: 'CREATE INDEX idx_wc_category_website ON website_categories (category_id, website_id)',
  },
  {
    table: 'website_keywords',
    name: 'idx_wk_keyword_website',
    sql: 'CREATE INDEX idx_wk_keyword_website ON website_keywords (keyword_id, website_id)',
  },
];

async function indexExists(pool, table, name) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [table, name]
  );
  return rows.length > 0;
}

async function main() {
  const pool = createPoolFromEnv();
  try {
    for (const index of INDEXES) {
      if (await indexExists(pool, index.table, index.name)) {
        console.log(`skip ${index.name}`);
        continue;
      }

      console.log(`create ${index.name}`);
      await pool.query(index.sql);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
