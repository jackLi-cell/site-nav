export const SITE_NAME = '网站收录导航';

export function getSiteUrl() {
  return process.env.APP_URL?.trim().replace(/\/+$/, '') || 'https://nav.jtlcookie.com';
}

export function getSitePageUrl(path = '') {
  const base = getSiteUrl();
  if (!path) return base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
