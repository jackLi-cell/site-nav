import { getDb } from '@/db';
import { websites } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { getSiteUrl } from '@/lib/site';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const appUrl = getSiteUrl();

  const latestSites = await db
    .select({
      name: websites.name,
      slug: websites.slug,
      shortSummary: websites.shortSummary,
      createdAt: websites.createdAt,
    })
    .from(websites)
    .where(eq(websites.status, 'active'))
    .orderBy(desc(websites.createdAt))
    .limit(50);

  const items = latestSites
    .map(
      (site) => `    <item>
      <title><![CDATA[${site.name}]]></title>
      <link>${appUrl}/sites/${site.slug}</link>
      <description><![CDATA[${site.shortSummary || ''}]]></description>
      <pubDate>${new Date(site.createdAt).toUTCString()}</pubDate>
      <guid>${appUrl}/sites/${site.slug}</guid>
    </item>`
    )
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>网站收录导航 - 最新收录</title>
    <link>${appUrl}</link>
    <description>精选网站收录与分类导航平台，发现优质网站资源。</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${appUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
