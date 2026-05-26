import path from 'path';

const SITE_ICON_ROUTE_PREFIX = '/site-icons';
const DEFAULT_SITE_ICON_DIR = path.join(process.cwd(), 'storage', 'site-icons');

export const SITE_ICON_EXTENSIONS = ['png', 'svg', 'ico', 'webp', 'jpg', 'jpeg', 'gif', 'avif'] as const;

export function sanitizeSiteIconKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildSiteIconUrl(normalizedDomain?: string | null) {
  const iconKey = sanitizeSiteIconKey(normalizedDomain || '');
  return iconKey ? `${SITE_ICON_ROUTE_PREFIX}/${encodeURIComponent(iconKey)}` : null;
}

export function resolveSiteIconUrl(iconPath?: string | null, normalizedDomain?: string | null) {
  if (iconPath) {
    return iconPath;
  }
  return buildSiteIconUrl(normalizedDomain);
}

export function getSiteIconStorageDir() {
  return process.env.SITE_ICON_STORAGE_DIR || DEFAULT_SITE_ICON_DIR;
}

export function getSiteIconMimeTypeByExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'ico':
      return 'image/x-icon';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}
