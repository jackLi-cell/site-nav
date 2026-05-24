import { getDb } from '@/db';
import { websites, categories as categoriesTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { getSiteUrl } from '@/lib/site';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const appUrl = getSiteUrl();

  const allSites = await db
    .select({ slug: websites.slug, updatedAt: websites.updatedAt })
    .from(websites)
    .where(eq(websites.status, 'active'));

  const allCategories = await db
    .select({ slug: categoriesTable.slug })
    .from(categoriesTable);

  const staticPages = [
    { loc: '', priority: '1.0' },
    { loc: '/sites', priority: '0.8' },
    { loc: '/categories', priority: '0.8' },
    { loc: '/tags', priority: '0.7' },
    { loc: '/pages/about', priority: '0.3' },
    { loc: '/pages/contact', priority: '0.3' },
    { loc: '/pages/privacy', priority: '0.3' },
    { loc: '/pages/disclaimer', priority: '0.3' },
  ];

  const urls = [
    ...staticPages.map(
      (p) =>
        `  <url><loc>${appUrl}${p.loc}</loc><priority>${p.priority}</priority></url>`
    ),
    ...allCategories.map(
      (c) =>
        `  <url><loc>${appUrl}/categories/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`
    ),
    ...allSites.map(
      (s) =>
        `  <url><loc>${appUrl}/sites/${s.slug}</loc><lastmod>${s.updatedAt}</lastmod><priority>0.6</priority></url>`
    ),
  ].join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
