import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'brasauto_session';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicPath = path === '/login' || path.startsWith('/_next') || path === '/favicon.ico';
  if (!publicPath && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set('x-brasauto-pathname', path);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!api).*)'] };
