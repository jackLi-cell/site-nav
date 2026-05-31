import { getDbFromRequest } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

let _sitesCache: any[] | null = null;
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
  company: string | null;
  language: string | null;
  isFree: string | null;
  is_free: string | null;
  starRating: number;
  star_rating: number;
  normalizedDomain: string;
  normalized_domain: string;
  iconPath: string | null;
  icon_path: string | null;
};

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

  if (category) {
    const { results: categoryRow } = await db.all<{ id: string }>(
      'SELECT id FROM categories WHERE slug = ? LIMIT 1',
      [category]
    );
    if (!categoryRow.length) {
      return Response.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
    const categoryId = categoryRow[0].id;

    const [sitesResult, countResult] = await Promise.all([
      db.all<SiteListRow>(`
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
          w.company,
          w.language,
          w.is_free AS isFree,
          w.is_free,
          w.star_rating AS starRating,
          w.star_rating,
          w.normalized_domain AS normalizedDomain,
          w.normalized_domain,
          w.icon_path AS iconPath,
          w.icon_path
        FROM websites w
        WHERE w.status = 'active'
          AND w.region = ?
          AND EXISTS (
            SELECT 1
            FROM website_categories wc
            WHERE wc.website_id = w.id
              AND wc.category_id = ?
          )
        ORDER BY w.view_count DESC, w.name ASC
        LIMIT ? OFFSET ?
      `, [region, categoryId, limit, offset]),
      db.all<{ count: number }>(`
        SELECT COUNT(*) AS count
        FROM website_categories wc
        INNER JOIN websites w ON w.id = wc.website_id
        WHERE wc.category_id = ?
          AND w.status = 'active'
          AND w.region = ?
      `, [categoryId, region]),
    ]);

    return Response.json({
      data: sitesResult.results,
      pagination: {
        page,
        limit,
        total: Number(countResult.results[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult.results[0]?.count || 0) / limit),
      },
    });
  }

  const [sitesResult, countResult] = await Promise.all([
    db.all<SiteListRow>(`
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
        w.company,
        w.language,
        w.is_free AS isFree,
        w.is_free,
        w.star_rating AS starRating,
        w.star_rating,
        w.normalized_domain AS normalizedDomain,
        w.normalized_domain,
        w.icon_path AS iconPath,
        w.icon_path
      FROM websites w
      WHERE w.status = 'active'
        AND w.region = ?
      ORDER BY w.view_count DESC, w.name ASC
      LIMIT ? OFFSET ?
    `, [region, limit, offset]),
    db.all<{ count: number }>(
      "SELECT COUNT(*) AS count FROM websites WHERE status = 'active' AND region = ?",
      [region]
    ),
  ]);

  return Response.json({
    data: sitesResult.results,
    pagination: {
      page,
      limit,
      total: Number(countResult.results[0]?.count || 0),
      totalPages: Math.ceil(Number(countResult.results[0]?.count || 0) / limit),
    },
  });
}
