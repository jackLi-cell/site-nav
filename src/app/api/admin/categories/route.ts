import { getDb } from '@/db';
import { categories } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const all = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  return Response.json({ data: all });
}

export async function POST(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const body = await request.json();

  if (!body.name || !body.slug) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '名称和 slug 必填' } }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(categories).values({
    id,
    name: body.name,
    slug: body.slug,
    description: body.description || null,
    parentId: body.parentId || null,
    sortOrder: body.sortOrder || 0,
    createdAt: now,
  });

  return Response.json({ data: { id } }, { status: 201 });
}
