import { websites, websiteKeywords, keywords } from '@/db/schema';
import { eq, and, like, or, desc, asc, sql } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

let _sitesCache: any[] | null = null;
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

  const searchPattern = `%${q}%`;
  const results = await db
    .select({
      id: websites.id,
      name: websites.name,
      slug: websites.slug,
      url: websites.url,
      shortSummary: websites.shortSummary,
      short_summary: websites.shortSummary,
      viewCount: websites.viewCount,
      view_count: websites.viewCount,
      normalizedDomain: websites.normalizedDomain,
      normalized_domain: websites.normalizedDomain,
      iconPath: websites.iconPath,
      icon_path: websites.iconPath,
      region: websites.region,
    })
    .from(websites)
    .leftJoin(websiteKeywords, eq(websites.id, websiteKeywords.websiteId))
    .leftJoin(keywords, eq(websiteKeywords.keywordId, keywords.id))
    .where(
      and(
        eq(websites.status, 'active'),
        eq(websites.region, region),
        or(
          like(websites.name, searchPattern),
          like(websites.shortSummary, searchPattern),
          like(keywords.name, searchPattern)
        )
      )
    )
    .groupBy(
      websites.id,
      websites.name,
      websites.slug,
      websites.url,
      websites.shortSummary,
      websites.viewCount,
      websites.normalizedDomain,
      websites.iconPath,
      websites.region
    )
    .orderBy(desc(websites.viewCount), asc(websites.name))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(distinct ${websites.id})` })
    .from(websites)
    .leftJoin(websiteKeywords, eq(websites.id, websiteKeywords.websiteId))
    .leftJoin(keywords, eq(websiteKeywords.keywordId, keywords.id))
    .where(
      and(
        eq(websites.status, 'active'),
        eq(websites.region, region),
        or(
          like(websites.name, searchPattern),
          like(websites.shortSummary, searchPattern),
          like(keywords.name, searchPattern)
        )
      )
    );

  return Response.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count || 0, totalPages: Math.ceil((countResult[0]?.count || 0) / limit) },
  });
}
