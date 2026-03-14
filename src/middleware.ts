import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`[Middleware] Path: ${pathname}`);

  if (
    pathname.startsWith('/api/telegram/webhook') ||
    pathname.startsWith('/api/cron/')
  ) {
    console.log(`[Middleware] Allowing: ${pathname}`);
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
