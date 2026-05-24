import { getDb } from '@/db';
import { websites } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

let _sitesCache: any[] | null = null;
function getSitesData() {
  if (!_sitesCache) _sitesCache = JSON.parse(readFileSync(join(process.cwd(), 'src/data-sites.json'), 'utf-8'));
  return _sitesCache!;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const hasDbConfig = !!process.env.DATABASE_URL || (!!process.env.MYSQL_HOST && !!process.env.MYSQL_USER && !!process.env.MYSQL_DATABASE);

  let targetUrl: string | null = null;

  if (!hasDbConfig) {
    const site = getSitesData().find((s: any) => s.slug === slug);
    if (!site) return new Response('Not Found', { status: 404 });
    targetUrl = site.url;
  } else {
    const db = getDb();
    const site = await db
      .select({ id: websites.id, url: websites.url })
      .from(websites)
      .where(and(eq(websites.slug, slug), eq(websites.status, 'active')))
      .limit(1);
    if (!site.length) return new Response('Not Found', { status: 404 });
    targetUrl = site[0].url;
  }

  if (!targetUrl) return new Response('Not Found', { status: 404 });

  return Response.redirect(targetUrl, 302);
}
