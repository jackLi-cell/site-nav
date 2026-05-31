import { categories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

let _sitesCache: any[] | null = null;
let _catsCache: any[] | null = null;
type SiteListRow = {
  id: string;
  name: string;
  slug: string;
  url: string;
  shortSummary: string | null;
  short_summary: string | null;
  viewCount: number;
  view_count: number;
  createdAt: string;
  created_at: string;
  region: string;
  normalizedDomain: string;
  normalized_domain: string;
  iconPath: string | null;
  icon_path: string | null;
};

const BROAD_CATEGORY_THRESHOLD = 1000;

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

  const websiteIndex = tab === 'latest' ? 'idx_websites_created' : 'idx_websites_sort';
  const orderSql = tab === 'latest'
    ? 'w.created_at DESC'
    : 'w.view_count DESC';
  const rankIndexedSelectSql = `
    SELECT
      w.id,
      w.name,
      w.slug,
      w.url,
      w.short_summary AS shortSummary,
      w.short_summary,
      w.view_count AS viewCount,
      w.view_count,
      w.created_at AS createdAt,
      w.created_at,
      w.region,
      w.normalized_domain AS normalizedDomain,
      w.normalized_domain,
      w.icon_path AS iconPath,
      w.icon_path
    FROM websites w FORCE INDEX (${websiteIndex})
    WHERE w.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM website_categories wc
        WHERE wc.website_id = w.id
          AND wc.category_id = ?
      )
      __REGION_FILTER__
    ORDER BY ${orderSql}
    LIMIT ? OFFSET ?
  `;
  const relationSelectSql = `
    SELECT
      w.id,
      w.name,
      w.slug,
      w.url,
      w.short_summary AS shortSummary,
      w.short_summary,
      w.view_count AS viewCount,
      w.view_count,
      w.created_at AS createdAt,
      w.created_at,
      w.region,
      w.normalized_domain AS normalizedDomain,
      w.normalized_domain,
      w.icon_path AS iconPath,
      w.icon_path
    FROM website_categories wc FORCE INDEX (idx_wc_category)
    INNER JOIN websites w ON w.id = wc.website_id
    WHERE wc.category_id = ?
      AND w.status = 'active'
      __REGION_FILTER__
    ORDER BY ${orderSql}
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS count
    FROM website_categories wc
    INNER JOIN websites w ON w.id = wc.website_id
    WHERE wc.category_id = ?
      AND w.status = 'active'
      __REGION_FILTER__
  `;
  const fetchResults = (filterRegion: boolean, mode: 'rank' | 'relation') => {
    const template = mode === 'rank' ? rankIndexedSelectSql : relationSelectSql;
    const sql = template.replace('__REGION_FILTER__', filterRegion && shouldFilterRegion ? 'AND w.region = ?' : '');
    const params = filterRegion && shouldFilterRegion
      ? [category[0].id, requestedRegion, limit, offset]
      : [category[0].id, limit, offset];
    return db.all<SiteListRow>(sql, params);
  };
  const fetchCount = (filterRegion: boolean) => {
    const sql = countSql.replace('__REGION_FILTER__', filterRegion && shouldFilterRegion ? 'AND w.region = ?' : '');
    const params = filterRegion && shouldFilterRegion
      ? [category[0].id, requestedRegion]
      : [category[0].id];
    return db.all<{ count: number }>(sql, params);
  };

  const categorySize = Number(category[0].websiteCount || category[0].website_count || 0);
  const useRankIndexFirst = categorySize >= BROAD_CATEGORY_THRESHOLD && tab !== 'latest';
  let results: { results: SiteListRow[] };
  let countResult: { results: { count: number }[] };

  if (useRankIndexFirst) {
    [results, countResult] = await Promise.all([fetchResults(true, 'rank'), fetchCount(true)]);
  } else {
    countResult = await fetchCount(true);
    results = Number(countResult.results[0]?.count || 0) > 0
      ? await fetchResults(true, 'relation')
      : { results: [] };
  }

  let total = Number(countResult.results[0]?.count || 0);
  let regionFallback = null;

  if (shouldFilterRegion && total === 0) {
    const fallbackCount = await fetchCount(false);
    const fallbackTotal = Number(fallbackCount.results[0]?.count || 0);
    if (fallbackTotal > 0) {
      results = await fetchResults(false, 'relation');
      countResult = fallbackCount;
      total = fallbackTotal;
      regionFallback = { requestedRegion, effectiveRegion: 'all' };
    }
  }

  return Response.json({
    category: category[0],
    data: results.results,
    regionFallback,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
