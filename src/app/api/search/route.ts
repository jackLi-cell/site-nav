import { getDbFromRequest } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

let _sitesCache: any[] | null = null;
type SearchSiteRow = {
  id: string;
  name: string;
  slug: string;
  url: string;
  shortSummary: string | null;
  short_summary: string | null;
  viewCount: number;
  view_count: number;
  normalizedDomain: string;
  normalized_domain: string;
  iconPath: string | null;
  icon_path: string | null;
  region: string;
};

function getSitesData() {
  if (!_sitesCache) _sitesCache = JSON.parse(readFileSync(join(process.cwd(), 'src/data-sites.json'), 'utf-8'));
  return _sitesCache!;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const region = url.searchParams.get('region') || 'china';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  if (!q) {
    return Response.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  const db = getDbFromRequest(request);

  if (!db) {
    const qLower = q.toLowerCase();
    const filtered = getSitesData().filter((s: any) =>
      s.region === region &&
      ((s.name || '').toLowerCase().includes(qLower) || (s.short_summary || '').toLowerCase().includes(qLower))
    );
    const data = filtered.slice(offset, offset + limit).map((s: any) => ({
      id: s.id, name: s.name, slug: s.slug, url: s.url,
      shortSummary: s.short_summary, viewCount: s.view_count,
      normalizedDomain: s.normalized_domain, normalized_domain: s.normalized_domain,
      iconPath: s.icon_path || null, icon_path: s.icon_path || null,
    }));
    return Response.json({ data, pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) } });
  }

  const keywordLimit = Math.min(250, limit * 8 + offset);
  const normalizedQ = q.toLowerCase();
  const directPromise = db.all<SearchSiteRow>(`
      SELECT
        w.id,
        w.name,
        w.slug,
        w.url,
        w.short_summary AS shortSummary,
        w.short_summary,
        w.view_count AS viewCount,
        w.view_count,
        w.normalized_domain AS normalizedDomain,
        w.normalized_domain,
        w.icon_path AS iconPath,
        w.icon_path,
        w.region
      FROM websites w FORCE INDEX (idx_websites_domain)
      WHERE w.status = 'active'
        AND w.region = ?
        AND w.normalized_domain LIKE ?
      ORDER BY w.view_count DESC
      LIMIT ?
    `, [region, `${normalizedQ}%`, keywordLimit]);
  const keywordPromise = q.length >= 3
    ? db.all<SearchSiteRow>(`
      SELECT
        w.id,
        w.name,
        w.slug,
        w.url,
        w.short_summary AS shortSummary,
        w.short_summary,
        w.view_count AS viewCount,
        w.view_count,
        w.normalized_domain AS normalizedDomain,
        w.normalized_domain,
        w.icon_path AS iconPath,
        w.icon_path,
        w.region
      FROM keywords k
      INNER JOIN website_keywords wk ON wk.keyword_id = k.id
      INNER JOIN websites w ON w.id = wk.website_id
      WHERE (
          k.name LIKE ?
          OR k.normalized LIKE ?
        )
        AND w.status = 'active'
        AND w.region = ?
      ORDER BY w.view_count DESC
      LIMIT ?
    `, [`${q}%`, `${normalizedQ}%`, region, keywordLimit])
    : Promise.resolve({ results: [] as SearchSiteRow[] });
  const categoryPromise = q.length >= 3
    ? db.all<SearchSiteRow>(`
      SELECT
        w.id,
        w.name,
        w.slug,
        w.url,
        w.short_summary AS shortSummary,
        w.short_summary,
        w.view_count AS viewCount,
        w.view_count,
        w.normalized_domain AS normalizedDomain,
        w.normalized_domain,
        w.icon_path AS iconPath,
        w.icon_path,
        w.region
      FROM categories c
      INNER JOIN website_categories wc FORCE INDEX (idx_wc_category) ON wc.category_id = c.id
      INNER JOIN websites w ON w.id = wc.website_id
      WHERE c.name LIKE ?
        AND w.status = 'active'
        AND w.region = ?
      ORDER BY w.view_count DESC
      LIMIT ?
    `, [`${q}%`, region, keywordLimit])
    : Promise.resolve({ results: [] as SearchSiteRow[] });
  const [directRows, keywordRows, categoryRows] = await Promise.all([directPromise, keywordPromise, categoryPromise]);

  const seen = new Set<string>();
  const merged = [...directRows.results, ...keywordRows.results, ...categoryRows.results]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => {
      const byViews = Number(b.view_count || 0) - Number(a.view_count || 0);
      return byViews || a.name.localeCompare(b.name);
    });
  const paged = merged.slice(offset, offset + limit);
  const total = merged.length;

  return Response.json({
    data: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
