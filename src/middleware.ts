import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { i18n } from '@/i18n/config';

const ADMIN_PATHS = ['/admin', '/api/admin'];
const AUTH_PATHS = ['/account', '/api/submissions'];
const SESSION_COOKIE = 'session_id';
const LOCALE_COOKIE = 'NEXT_LOCALE';

function getExternalOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'http';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function getLocaleFromPathname(pathname: string): string | undefined {
  return i18n.locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
}

function getPreferredLocale(request: NextRequest): string {
  // Check cookie first
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && i18n.locales.includes(cookieLocale as any)) {
    return cookieLocale;
  }

  // Check Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    const langs = acceptLang.split(',').map((l) => {
      const [lang, q] = l.trim().split(';q=');
      return { lang: lang.trim(), q: q ? parseFloat(q) : 1 };
    });
    langs.sort((a, b) => b.q - a.q);

    for (const { lang } of langs) {
      // Exact match
      if (i18n.locales.includes(lang as any)) return lang;
      // Prefix match (e.g., "zh" matches "zh-CN")
      const prefix = lang.split('-')[0];
      const match = i18n.locales.find((l) => l.startsWith(prefix));
      if (match) return match;
    }
  }

  return i18n.defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, API routes, and special Next.js paths
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/out/') ||
    pathname === '/feed.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if pathname already has a locale
  const pathnameLocale = getLocaleFromPathname(pathname);

  if (pathnameLocale) {
    // Locale is present in URL, handle auth checks
    const pathWithoutLocale = pathname.replace(`/${pathnameLocale}`, '') || '/';

    const isAdminPath = ADMIN_PATHS.some((p) => pathWithoutLocale.startsWith(p));
    const isAuthPath = AUTH_PATHS.some((p) => pathWithoutLocale.startsWith(p));

    if (isAdminPath || isAuthPath) {
      const session = request.cookies.get(SESSION_COOKIE);
      if (!session) {
        return NextResponse.redirect(
          new URL(`/${pathnameLocale}/login`, getExternalOrigin(request))
        );
      }
    }

    // Set locale cookie for future visits
    const response = NextResponse.next();
    response.cookies.set(LOCALE_COOKIE, pathnameLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  // No locale in URL - redirect to locale-prefixed URL
  const locale = getPreferredLocale(request);
  const newUrl = new URL(`/${locale}${pathname === '/' ? '' : pathname}`, getExternalOrigin(request));
  newUrl.search = request.nextUrl.search;

  const response = NextResponse.redirect(newUrl);
  response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
