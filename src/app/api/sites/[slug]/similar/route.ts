import { websites, websiteCategories } from '@/db/schema';
import { eq, and, ne, sql, desc } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const site = await db
    .select({ id: websites.id, region: websites.region })
    .from(websites)
    .where(and(eq(websites.slug, slug), eq(websites.status, 'active')))
    .limit(1);

  if (!site.length) {
    return Response.json({ data: [] });
  }

  const siteId = site[0].id;
  const region = site[0].region;

  const siteCategoryIds = await db
    .select({ categoryId: websiteCategories.categoryId })
    .from(websiteCategories)
    .where(eq(websiteCategories.websiteId, siteId));

  if (!siteCategoryIds.length) {
    return Response.json({ data: [] });
  }

  const categoryIdList = siteCategoryIds.map((r) => r.categoryId);

  const similar = await db
    .select({
      id: websites.id,
      name: websites.name,
      slug: websites.slug,
      shortSummary: websites.shortSummary,
      viewCount: websites.viewCount,
    })
    .from(websites)
    .innerJoin(websiteCategories, eq(websites.id, websiteCategories.websiteId))
    .where(
      and(
        eq(websites.status, 'active'),
        eq(websites.region, region),
        ne(websites.id, siteId),
        sql`${websiteCategories.categoryId} IN (${sql.join(categoryIdList.map(id => sql`${id}`), sql`, `)})`
      )
    )
    .groupBy(websites.id, websites.name, websites.slug, websites.shortSummary, websites.viewCount)
    .orderBy(desc(sql`count(*)`), desc(websites.viewCount))
    .limit(6);

  return Response.json({ data: similar });
}
