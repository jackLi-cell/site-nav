import { websites, websiteCategories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeUrl, extractDomain } from '@/lib/utils';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }
  const body = await request.json();

  const existing = await db.select({ id: websites.id }).from(websites).where(eq(websites.id, id)).limit(1);
  if (!existing.length) {
    return Response.json({ error: { code: 'NOT_FOUND', message: '网站不存在' } }, { status: 404 });
  }

  const updates: any = { updatedAt: new Date().toISOString() };
  if (body.name) updates.name = body.name;
  if (body.url) {
    updates.url = normalizeUrl(body.url);
    updates.normalizedDomain = extractDomain(body.url);
  }
  if (body.shortSummary !== undefined) updates.shortSummary = body.shortSummary;
  if (body.fullDescription !== undefined) updates.fullDescription = body.fullDescription;
  if (body.status) updates.status = body.status;

  await db.update(websites).set(updates).where(eq(websites.id, id));

  if (body.categoryIds) {
    await db.delete(websiteCategories).where(eq(websiteCategories.websiteId, id));
    for (const catId of body.categoryIds) {
      await db.insert(websiteCategories).values({ websiteId: id, categoryId: catId });
    }
  }

  return Response.json({ data: { id } });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  await db.update(websites).set({ status: 'removed', updatedAt: new Date().toISOString() }).where(eq(websites.id, id));

  return Response.json({ data: { id, status: 'removed' } });
}
