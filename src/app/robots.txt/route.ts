import { getSiteUrlFromRequest } from '@/lib/site';

export async function GET(request: Request) {
  const siteUrl = getSiteUrlFromRequest(request);
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /account/

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
