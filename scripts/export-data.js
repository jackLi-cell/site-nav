const fs = require('fs');
const path = require('path');
const { createPoolFromEnv } = require('./mysql-utils');

async function main() {
  const pool = createPoolFromEnv();

  const [categoryRows] = await pool.query(
    'SELECT id, name, slug, description, icon, parent_id, level, sort_order, website_count, created_at FROM categories ORDER BY sort_order ASC, name ASC'
  );

  const [siteRows] = await pool.query(
    'SELECT id, name, slug, url, normalized_domain, short_summary, view_count, created_at, region FROM websites WHERE status = ? ORDER BY view_count DESC, name ASC',
    ['active']
  );

  const [siteCategoryRows] = await pool.query(
    'SELECT wc.website_id, c.slug FROM website_categories wc INNER JOIN categories c ON c.id = wc.category_id'
  );

  const siteCategories = new Map();
  for (const row of siteCategoryRows) {
    if (!siteCategories.has(row.website_id)) {
      siteCategories.set(row.website_id, []);
    }
    siteCategories.get(row.website_id).push(row.slug);
  }

  const sites = siteRows.map((site) => ({
    id: site.id,
    name: site.name,
    slug: site.slug,
    url: site.url,
    normalized_domain: site.normalized_domain,
    short_summary: site.short_summary,
    view_count: site.view_count,
    created_at: site.created_at,
    region: site.region,
    categories: siteCategories.get(site.id) || [],
  }));

  fs.writeFileSync(path.join(__dirname, '../src/data-sites.json'), JSON.stringify(sites), 'utf-8');
  fs.writeFileSync(path.join(__dirname, '../src/data-categories.json'), JSON.stringify(categoryRows), 'utf-8');

  console.log(`Exported ${sites.length} sites to src/data-sites.json`);
  console.log(`Exported ${categoryRows.length} categories to src/data-categories.json`);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
