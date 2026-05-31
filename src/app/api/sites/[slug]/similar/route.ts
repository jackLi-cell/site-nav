import { getDbFromRequest } from '@/lib/api-helpers';

type SimilarCandidateRow = {
  id: string;
  name: string;
  slug: string;
  shortSummary: string | null;
  short_summary: string | null;
  viewCount: number;
  view_count: number;
  normalizedDomain: string;
  normalized_domain: string;
  iconPath: string | null;
  icon_path: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const site = await db.all<{ id: string; region: string }>(
    "SELECT id, region FROM websites WHERE slug = ? AND status = 'active' LIMIT 1",
    [slug]
  );

  if (!site.results.length) {
    return Response.json({ data: [] });
  }

  const siteId = site.results[0].id;
  const region = site.results[0].region;

  const siteCategoryIds = await db.all<{ categoryId: string; category_id: string }>(
    'SELECT category_id AS categoryId, category_id FROM website_categories WHERE website_id = ?',
    [siteId]
  );

  if (!siteCategoryIds.results.length) {
    return Response.json({ data: [] });
  }

  const categoryIdList = siteCategoryIds.results.map((row) => row.categoryId || row.category_id);
  const placeholders = categoryIdList.map(() => '?').join(', ');
  const candidateLimit = Math.max(36, Math.min(120, categoryIdList.length * 24));

  const candidates = await db.all<SimilarCandidateRow>(`
    SELECT
      w.id,
      w.name,
      w.slug,
      w.short_summary AS shortSummary,
      w.short_summary,
      w.view_count AS viewCount,
      w.view_count,
      w.normalized_domain AS normalizedDomain,
      w.normalized_domain,
      w.icon_path AS iconPath,
      w.icon_path
    FROM websites w FORCE INDEX (idx_websites_sort)
    WHERE w.status = 'active'
      AND w.region = ?
      AND w.id <> ?
      AND EXISTS (
        SELECT 1
        FROM website_categories wc
        WHERE wc.website_id = w.id
          AND wc.category_id IN (${placeholders})
      )
    ORDER BY w.view_count DESC
    LIMIT ?
  `, [region, siteId, ...categoryIdList, candidateLimit]);

  const scored = candidates.results
    .map((row) => ({
      ...row,
      overlap: 0,
    }));

  if (scored.length > 0) {
    const candidateIds = scored.map((row) => row.id);
    const candidatePlaceholders = candidateIds.map(() => '?').join(', ');
    const overlaps = await db.all<{ websiteId: string; website_id: string; overlap: number }>(`
      SELECT wc.website_id AS websiteId, wc.website_id, COUNT(*) AS overlap
      FROM website_categories wc
      WHERE wc.website_id IN (${candidatePlaceholders})
        AND wc.category_id IN (${placeholders})
      GROUP BY wc.website_id
    `, [...candidateIds, ...categoryIdList]);
    const overlapById = new Map(
      overlaps.results.map((row) => [row.websiteId || row.website_id, Number(row.overlap || 0)])
    );
    scored.forEach((row) => {
      row.overlap = overlapById.get(row.id) || 0;
    });
  }

  const similar = scored
    .sort((a, b) => {
      const byOverlap = b.overlap - a.overlap;
      return byOverlap || Number(b.view_count || 0) - Number(a.view_count || 0);
    })
    .slice(0, 6);

  return Response.json({ data: similar });
}
