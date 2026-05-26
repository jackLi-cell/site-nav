import { websites, websiteCategories, categories } from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

let _sitesCache: any[] | null = null;
function getSitesData() {
  if (!_sitesCache) {
    const raw = readFileSync(join(process.cwd(), 'src/data-sites.json'), 'utf-8');
    _sitesCache = JSON.parse(raw);
  }
  return _sitesCache!;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const region = url.searchParams.get('region') || 'china';
  const category = url.searchParams.get('category') || '';
  const offset = (page - 1) * limit;

  const db = getDbFromRequest(request);

  if (!db) {
    let filtered = getSitesData().filter((s: any) => s.region === region);
    if (category) {
      filtered = filtered.filter((s: any) => (s.categories || []).includes(category));
    }
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit).map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      url: s.url,
      shortSummary: s.short_summary,
      viewCount: s.view_count,
      createdAt: s.created_at,
      region: s.region,
      normalizedDomain: s.normalized_domain,
      normalized_domain: s.normalized_domain,
      iconPath: s.icon_path || null,
      icon_path: s.icon_path || null,
    }));
    return Response.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  const baseSelect = {
    id: websites.id,
    name: websites.name,
    slug: websites.slug,
    url: websites.url,
    shortSummary: websites.shortSummary,
    short_summary: websites.shortSummary,
    viewCount: websites.viewCount,
    view_count: websites.viewCount,
    createdAt: websites.createdAt,
    created_at: websites.createdAt,
    region: websites.region,
    company: websites.company,
    language: websites.language,
    isFree: websites.isFree,
    is_free: websites.isFree,
    starRating: websites.starRating,
    star_rating: websites.starRating,
    normalizedDomain: websites.normalizedDomain,
    normalized_domain: websites.normalizedDomain,
    iconPath: websites.iconPath,
    icon_path: websites.iconPath,
  } as const;

  const conditions = [eq(websites.status, 'active'), eq(websites.region, region)];
  if (category) {
    const categoryRow = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, category)).limit(1);
    if (!categoryRow.length) {
      return Response.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
    conditions.push(eq(websiteCategories.categoryId, categoryRow[0].id));

    const results = await db
      .select(baseSelect)
      .from(websites)
      .innerJoin(websiteCategories, eq(websites.id, websiteCategories.websiteId))
      .where(and(...conditions))
      .orderBy(desc(websites.viewCount), asc(websites.name))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(distinct ${websites.id})` })
      .from(websites)
      .innerJoin(websiteCategories, eq(websites.id, websiteCategories.websiteId))
      .where(and(...conditions));

    return Response.json({
      data: results,
      pagination: { page, limit, total: countResult[0]?.count || 0, totalPages: Math.ceil((countResult[0]?.count || 0) / limit) },
    });
  }

  const results = await db
    .select(baseSelect)
    .from(websites)
    .where(and(...conditions))
    .orderBy(desc(websites.viewCount), asc(websites.name))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(distinct ${websites.id})` })
    .from(websites)
    .where(and(...conditions));

  return Response.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count || 0, totalPages: Math.ceil((countResult[0]?.count || 0) / limit) },
  });
}
