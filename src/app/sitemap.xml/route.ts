import { getDb } from '@/db';
import { websites, categories as categoriesTable } from '@/db/schema';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { getLocalizedPath, getSitePageUrl, getSiteUrlFromRequest } from '@/lib/site';

const LOCALES = ['zh-CN', 'en'] as const;
const CORE_CATEGORY_SLUGS = [
  'ai-tools',
  'developer-tools',
  'design-resources',
  'productivity',
  'cloud-services',
  'data-analytics',
  'marketing',
  'learning',
  'open-source',
  'search-engines',
  'ecommerce',
  'finance',
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAlternateLinks(baseUrl: string, path: string) {
  const cleanPath = path.replace(/\/+$/, '') || '/';
  return [
    ...LOCALES.map(
      (locale) =>
        `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(
          getSitePageUrl(getLocalizedPath(locale, cleanPath), baseUrl)
        )}"/>`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
      getSitePageUrl(getLocalizedPath('zh-CN', cleanPath), baseUrl)
    )}"/>`,
  ].join('\n');
}

function buildUrlEntry({
  baseUrl,
  locale,
  path,
  priority,
  changefreq,
  lastmod,
}: {
  baseUrl: string;
  locale: string;
  path: string;
  priority: string;
  changefreq?: string;
  lastmod?: string;
}) {
  const loc = getSitePageUrl(getLocalizedPath(locale, path), baseUrl);
  const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';
  const changefreqTag = changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : '';

  return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmodTag}${changefreqTag}
    <priority>${priority}</priority>
${buildAlternateLinks(baseUrl, path)}
  </url>`;
}

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const appUrl = getSiteUrlFromRequest(request);

  const coreSites = await db
    .select({ slug: websites.slug, updatedAt: websites.updatedAt })
    .from(websites)
    .where(
      and(
        eq(websites.status, 'active'),
        or(eq(websites.starRating, 5), eq(websites.starRating, 4))
      )
    )
    .orderBy(desc(websites.starRating), desc(websites.viewCount), desc(websites.updatedAt))
    .limit(12);

  const coreCategories = await db
    .select({ slug: categoriesTable.slug })
    .from(categoriesTable)
    .where(inArray(categoriesTable.slug, CORE_CATEGORY_SLUGS))
    .limit(CORE_CATEGORY_SLUGS.length);

  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/sites', priority: '0.8', changefreq: 'weekly' },
    { path: '/categories', priority: '0.8', changefreq: 'weekly' },
    { path: '/tags', priority: '0.7', changefreq: 'weekly' },
    { path: '/submit', priority: '0.5', changefreq: 'monthly' },
    { path: '/pages/about', priority: '0.3', changefreq: 'monthly' },
    { path: '/pages/contact', priority: '0.3', changefreq: 'monthly' },
    { path: '/pages/privacy', priority: '0.3', changefreq: 'monthly' },
    { path: '/pages/disclaimer', priority: '0.3', changefreq: 'monthly' },
  ];

  const urls = [
    ...LOCALES.flatMap((locale) =>
      staticPages.map((page) =>
        buildUrlEntry({
          baseUrl: appUrl,
          locale,
          path: page.path,
          priority: page.priority,
          changefreq: page.changefreq,
        })
      )
    ),
    ...LOCALES.flatMap((locale) =>
      coreCategories.map((category) =>
        buildUrlEntry({
          baseUrl: appUrl,
          locale,
          path: `/categories/${category.slug}`,
          priority: '0.7',
          changefreq: 'weekly',
        })
      )
    ),
    ...LOCALES.flatMap((locale) =>
      coreSites.map((site) =>
        buildUrlEntry({
          baseUrl: appUrl,
          locale,
          path: `/sites/${site.slug}`,
          priority: '0.6',
          changefreq: 'monthly',
          lastmod: site.updatedAt,
        })
      )
    ),
  ].join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
