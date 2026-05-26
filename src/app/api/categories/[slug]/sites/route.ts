import { websites, websiteCategories, categories } from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
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
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const requestedRegion = url.searchParams.get('region') || 'china';
  const shouldFilterRegion = requestedRegion === 'china' || requestedRegion === 'overseas';
  const tab = url.searchParams.get('tab') || 'default';
  const offset = (page - 1) * limit;

  const db = getDbFromRequest(request);

  if (!db) {
    const category = getCatsData().find((c: any) => c.slug === slug);
    if (!category) {
      return Response.json({ error: { code: 'NOT_FOUND', message: '分类不存在' } }, { status: 404 });
    }
    let filtered = getSitesData().filter((s: any) =>
      (!shouldFilterRegion || s.region === requestedRegion) && (s.categories || []).includes(slug)
    );
    const requestedTotal = filtered.length;
    let regionFallback = null;
    if (shouldFilterRegion && requestedTotal === 0) {
      const fallback = getSitesData().filter((s: any) => (s.categories || []).includes(slug));
      if (fallback.length > 0) {
        filtered = fallback;
        regionFallback = { requestedRegion, effectiveRegion: 'all' };
      }
    }
    if (tab === 'latest') filtered = [...filtered].reverse();
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit).map((s: any) => ({
      id: s.id, name: s.name, slug: s.slug, url: s.url,
      shortSummary: s.short_summary, viewCount: s.view_count, createdAt: s.created_at,
      normalizedDomain: s.normalized_domain, normalized_domain: s.normalized_domain,
      iconPath: s.icon_path || null, icon_path: s.icon_path || null,
    }));
    return Response.json({ category, data, regionFallback, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  const category = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      icon: categories.icon,
      parentId: categories.parentId,
      parent_id: categories.parentId,
      level: categories.level,
      sortOrder: categories.sortOrder,
      sort_order: categories.sortOrder,
      websiteCount: categories.websiteCount,
      website_count: categories.websiteCount,
      createdAt: categories.createdAt,
      created_at: categories.createdAt,
    })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  if (!category.length) {
    return Response.json({ error: { code: 'NOT_FOUND', message: '分类不存在' } }, { status: 404 });
  }

  const orderBy = tab === 'latest' ? [desc(websites.createdAt)] : [desc(websites.viewCount), asc(websites.name)];
  const makeWhere = (filterRegion: boolean) => {
    const conditions = [eq(websites.status, 'active'), eq(websiteCategories.categoryId, category[0].id)];
    if (filterRegion && shouldFilterRegion) {
      conditions.push(eq(websites.region, requestedRegion));
    }
    return and(...conditions);
  };
  const fetchResults = (filterRegion: boolean) => db
    .select({
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
      normalizedDomain: websites.normalizedDomain,
      normalized_domain: websites.normalizedDomain,
      iconPath: websites.iconPath,
      icon_path: websites.iconPath,
    })
    .from(websites)
    .innerJoin(websiteCategories, eq(websites.id, websiteCategories.websiteId))
    .where(makeWhere(filterRegion))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);
  const fetchCount = (filterRegion: boolean) => db
    .select({ count: sql<number>`count(distinct ${websites.id})` })
    .from(websites)
    .innerJoin(websiteCategories, eq(websites.id, websiteCategories.websiteId))
    .where(makeWhere(filterRegion));

  let results = await fetchResults(true);
  let countResult = await fetchCount(true);
  let total = Number(countResult[0]?.count || 0);
  let regionFallback = null;

  if (shouldFilterRegion && total === 0) {
    const fallbackCount = await fetchCount(false);
    const fallbackTotal = Number(fallbackCount[0]?.count || 0);
    if (fallbackTotal > 0) {
      results = await fetchResults(false);
      countResult = fallbackCount;
      total = fallbackTotal;
      regionFallback = { requestedRegion, effectiveRegion: 'all' };
    }
  }

  return Response.json({
    category: category[0],
    data: results,
    regionFallback,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
