import { websites, websiteCategories, categories, websiteKeywords, keywords } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

let _sitesCache: any[] | null = null;
let _catsCache: any[] | null = null;
function getSitesData() {
  if (!_sitesCache) _sitesCache = JSON.parse(readFileSync(join(process.cwd(), 'src/data-sites.json'), 'utf-8'));
  return _sitesCache!;
}
function getCatsData() {
  if (!_catsCache) _catsCache = JSON.parse(readFileSync(join(process.cwd(), 'src/data-categories.json'), 'utf-8'));
  return _catsCache!;
}

export async function GET(
  request: Request,
  { params }: { params: any }
) {
  const slug = params.slug || (await params)?.slug;
  const db = getDbFromRequest(request);

  if (!db) {
    const site = getSitesData().find((s: any) => s.slug === slug);
    if (!site) {
      return Response.json({ error: { code: 'NOT_FOUND', message: '网站不存在' } }, { status: 404 });
    }
    const cats = (site.categories || [])
      .map((cslug: string) => getCatsData().find((c: any) => c.slug === cslug))
      .filter(Boolean);
    return Response.json({
      data: {
        id: site.id, name: site.name, slug: site.slug, url: site.url,
        normalizedDomain: site.normalized_domain, shortSummary: site.short_summary,
        viewCount: site.view_count, createdAt: site.created_at, region: site.region,
        iconPath: site.icon_path || null,
        icon_path: site.icon_path || null,
        status: 'active', categories: cats, keywords: [],
      },
    });
  }

  const site = await db
    .select({
      id: websites.id,
      name: websites.name,
      slug: websites.slug,
      url: websites.url,
      normalizedDomain: websites.normalizedDomain,
      shortSummary: websites.shortSummary,
      short_summary: websites.shortSummary,
      fullDescription: websites.fullDescription,
      full_description: websites.fullDescription,
      viewCount: websites.viewCount,
      view_count: websites.viewCount,
      createdAt: websites.createdAt,
      created_at: websites.createdAt,
      region: websites.region,
      status: websites.status,
      iconPath: websites.iconPath,
      icon_path: websites.iconPath,
    })
    .from(websites)
    .where(and(eq(websites.slug, slug), eq(websites.status, 'active')))
    .limit(1);
  if (!site.length) {
    return Response.json({ error: { code: 'NOT_FOUND', message: '网站不存在' } }, { status: 404 });
  }
  const siteData = site[0];
  const siteCategories = await db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(websiteCategories).innerJoin(categories, eq(websiteCategories.categoryId, categories.id)).where(eq(websiteCategories.websiteId, siteData.id));
  const siteKeywords = await db.select({ id: keywords.id, name: keywords.name }).from(websiteKeywords).innerJoin(keywords, eq(websiteKeywords.keywordId, keywords.id)).where(eq(websiteKeywords.websiteId, siteData.id));
  return Response.json({ data: { ...siteData, categories: siteCategories, keywords: siteKeywords } });
}
