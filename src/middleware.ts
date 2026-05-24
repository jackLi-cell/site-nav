import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_PATHS = ['/admin', '/api/admin'];
const AUTH_PATHS = ['/account', '/api/submissions'];
const SESSION_COOKIE = 'session_id';

function getExternalOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'http';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (isAdminPath || isAuthPath) {
    const session = request.cookies.get(SESSION_COOKIE);
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', getExternalOrigin(request)));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/account/:path*', '/api/submissions/:path*'],
};
