import { websites, categories, outboundClickEvents } from '@/db/schema';
import { eq, sql, gte } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const totalSites = await db.select({ count: sql<number>`count(*)` }).from(websites).where(eq(websites.status, 'active'));
  const totalCategories = await db.select({ count: sql<number>`count(*)` }).from(categories);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weeklyClicks = await db
    .select({ count: sql<number>`count(*)` })
    .from(outboundClickEvents)
    .where(gte(outboundClickEvents.createdAt, sevenDaysAgo));

  return Response.json({
    data: {
      totalSites: totalSites[0]?.count || 0,
      totalCategories: totalCategories[0]?.count || 0,
      weeklyClicks: weeklyClicks[0]?.count || 0,
    },
  });
}
