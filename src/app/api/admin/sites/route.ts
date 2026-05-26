import { websites, websiteCategories, websiteKeywords, keywords } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { normalizeUrl, extractDomain, generateSlug } from '@/lib/utils';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  const results = await db
    .select({
      id: websites.id,
      name: websites.name,
      slug: websites.slug,
      url: websites.url,
      normalizedDomain: websites.normalizedDomain,
      normalized_domain: websites.normalizedDomain,
      shortSummary: websites.shortSummary,
      short_summary: websites.shortSummary,
      fullDescription: websites.fullDescription,
      full_description: websites.fullDescription,
      status: websites.status,
      region: websites.region,
      starRating: websites.starRating,
      star_rating: websites.starRating,
      viewCount: websites.viewCount,
      view_count: websites.viewCount,
      iconPath: websites.iconPath,
      icon_path: websites.iconPath,
      createdAt: websites.createdAt,
      created_at: websites.createdAt,
      updatedAt: websites.updatedAt,
      updated_at: websites.updatedAt,
    })
    .from(websites)
    .orderBy(desc(websites.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(websites);

  return Response.json({
    data: results,
    pagination: { page, limit, total: countResult[0]?.count || 0 },
  });
}

export async function POST(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const body = await request.json();
  const { name, url: siteUrl, shortSummary, fullDescription, categoryIds, keywordNames } = body;

  if (!name || !siteUrl) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '名称和 URL 必填' } }, { status: 400 });
  }

  const normalizedUrl = normalizeUrl(siteUrl);
  const domain = extractDomain(siteUrl);
  const slug = generateSlug(name);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(websites).values({
    id,
    name,
    slug,
    url: normalizedUrl,
    normalizedDomain: domain,
    shortSummary: shortSummary || null,
    fullDescription: fullDescription || null,
    status: 'active',
    starRating: 1,
    viewCount: 0,
    iconFetchStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  if (categoryIds?.length) {
    for (const catId of categoryIds) {
      await db.insert(websiteCategories).values({ websiteId: id, categoryId: catId });
    }
  }

  if (keywordNames?.length) {
    for (const kwName of keywordNames) {
      const normalized = kwName.toLowerCase().trim().replace(/\s+/g, '');
      const existing = await db.select().from(keywords).where(eq(keywords.normalized, normalized)).limit(1);
      let kwId: string;
      if (existing.length) {
        kwId = existing[0].id;
      } else {
        kwId = crypto.randomUUID();
        await db.insert(keywords).values({ id: kwId, name: kwName.trim(), normalized, createdAt: now });
      }
      await db.insert(websiteKeywords).values({ websiteId: id, keywordId: kwId });
    }
  }

  return Response.json({ data: { id, slug } }, { status: 201 });
}
