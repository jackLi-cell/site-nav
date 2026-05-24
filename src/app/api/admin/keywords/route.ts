import { getDb } from '@/db';
import { keywords } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const all = await db.select().from(keywords).orderBy(asc(keywords.name));
  return Response.json({ data: all });
}

export async function POST(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const body = await request.json();

  if (!body.name) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '关键词名称必填' } }, { status: 400 });
  }

  const normalized = body.name.toLowerCase().trim().replace(/\s+/g, '');
  const existing = await db.select().from(keywords).where(eq(keywords.normalized, normalized)).limit(1);

  if (existing.length) {
    return Response.json({ error: { code: 'DUPLICATE', message: '关键词已存在' } }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await db.insert(keywords).values({
    id,
    name: body.name.trim(),
    normalized,
    createdAt: new Date().toISOString(),
  });

  return Response.json({ data: { id } }, { status: 201 });
}
