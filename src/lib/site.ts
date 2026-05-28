export const SITE_NAME = '网站收录导航';

const PUBLIC_HOSTS = new Set(['nav.jtlcook.com', 'nav.jtlcookie.com']);
const PUBLIC_LOCALES = ['zh-CN', 'en'] as const;

type HeaderLike = {
  get(name: string): string | null;
};

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '');
}

function getFallbackSiteUrl() {
  return normalizeOrigin(process.env.APP_URL || 'https://nav.jtlcookie.com');
}

export function getSiteUrl() {
  return getFallbackSiteUrl();
}

export function getSiteUrlFromHeaders(headersList: HeaderLike) {
  const forwardedHost = headersList.get('x-forwarded-host') || headersList.get('host');
  const host = forwardedHost?.split(',')[0]?.trim();

  if (!host) return getFallbackSiteUrl();

  const hostname = host.split(':')[0];
  const forwardedProto = headersList.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto || (PUBLIC_HOSTS.has(hostname) ? 'https' : 'http');

  return normalizeOrigin(`${proto}://${host}`);
}

export function getSiteUrlFromRequest(request: Request) {
  return getSiteUrlFromHeaders(request.headers);
}

export function getSitePageUrl(path = '', base = getSiteUrl()) {
  if (!path) return base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function stripLocaleFromPath(path = '/') {
  const normalizedPath = path.split('?')[0].replace(/\/+$/, '') || '/';
  const locale = PUBLIC_LOCALES.find(
    (l) => normalizedPath === `/${l}` || normalizedPath.startsWith(`/${l}/`)
  );

  if (!locale) return normalizedPath;

  return normalizedPath.replace(`/${locale}`, '') || '/';
}

export function getLocalizedPath(locale: string, path = '/') {
  const cleanPath = stripLocaleFromPath(path);
  return cleanPath === '/' ? `/${locale}` : `/${locale}${cleanPath}`;
}

export function getSeoUrls(path = '/', base = getSiteUrl()) {
  const canonicalPath = path.split('?')[0].replace(/\/+$/, '') || '/';

  return {
    canonical: getSitePageUrl(canonicalPath, base),
    languages: {
      'zh-CN': getSitePageUrl(getLocalizedPath('zh-CN', canonicalPath), base),
      en: getSitePageUrl(getLocalizedPath('en', canonicalPath), base),
      'x-default': getSitePageUrl(getLocalizedPath('zh-CN', canonicalPath), base),
    },
  };
}
