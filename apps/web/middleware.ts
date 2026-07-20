import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route dropper.droptrack.com.au/* to /dropper/* internally so the whole
 * dropper portal lives under the same Next build as the client portal.
 *
 * - Skips /api, /_next, static files, favicon, manifest, and paths already
 *   under /dropper (avoids infinite rewrite loop).
 * - Keeps the URL bar clean — user sees dropper.droptrack.com.au/jobs
 *   while Next renders /dropper/jobs.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (!host.startsWith('dropper.')) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Paths that must render at their own top-level route on dropper.* — auth
  // pages, static assets, and the /dropper tree itself (avoids rewrite loop).
  const passthrough = [
    '/api',
    '/_next',
    '/dropper',
    '/login',
    '/signup',
    '/forgot-password',
    '/accept-invite',
    '/terms',
    '/privacy',
    '/cookies',
    '/icons/',
  ];
  if (
    passthrough.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p)) ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest'
  ) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/dropper${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
