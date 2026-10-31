import { NextRequest, NextResponse } from 'next/server';
import { apiError, markdownResponse, negotiatePage, notFoundMarkdown } from '@/lib/httpResponses';
import { homepageMarkdown } from '@/lib/siteContent';
import { isPublicFile, staticPaths } from '@/lib/siteRoutes';
import { apiPolicy } from '@/lib/apiPolicy';
import {
  checkRateLimit,
  getClientIp,
  PROXY_RATE_LIMIT,
  rateLimitResponseHeaders,
} from '@/lib/rateLimit';

/** Returns the negotiated 404 representation before React begins streaming. */
function missingPage(request: NextRequest) {
  if (negotiatePage(request.headers.get('accept')) === 'markdown') {
    return markdownResponse(notFoundMarkdown, 404);
  }
  // Decide the status before React can start streaming the shared page layout.
  return NextResponse.rewrite(new URL('/404', request.url), {
    status: 404,
    headers: { Vary: 'Accept', 'Cache-Control': 'no-store' },
  });
}

/**
 * The image optimizer fetches /api/proxy URLs internally without the visitor's headers, so the
 * route cannot tell visitors apart. Charge those optimizations to the visitor's proxy quota here.
 */
function limitProxiedImage(request: NextRequest) {
  if (!request.nextUrl.searchParams.get('url')?.startsWith('/api/proxy/')) {
    return NextResponse.next();
  }
  const limit = checkRateLimit('proxy:' + getClientIp(request), PROXY_RATE_LIMIT);
  if (limit.allowed) return NextResponse.next();
  return apiError(
    'Too many proxy requests. Please try again later.',
    429,
    rateLimitResponseHeaders(limit, PROXY_RATE_LIMIT, 'proxy'),
  );
}

/** Negotiates agent content and checks public resources before dispatching to Next.js. */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/_next/image') return limitProxiedImage(request);
  if (path === '/api' || path.startsWith('/api/')) {
    const { headers, response } = apiPolicy(request);
    return response ?? NextResponse.next({ headers });
  }
  if (!['GET', 'HEAD'].includes(request.method)) return NextResponse.next();
  if (path === '/') {
    // Flight responses used by client navigation are a separate Next.js representation.
    if (request.headers.get('rsc') === '1') return NextResponse.next();
    const representation = negotiatePage(request.headers.get('accept'));
    if (representation === 'markdown') return markdownResponse(homepageMarkdown);
    if (!representation) {
      return new NextResponse('Supported representations: text/html and text/markdown.\n', {
        status: 406,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Vary: 'Accept',
          'Cache-Control': 'no-store',
        },
      });
    }
    return NextResponse.next({ headers: { Vary: 'Accept' } });
  }
  if (staticPaths.has(path) || (await isPublicFile(path))) return NextResponse.next();
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 2 || path === '/404') return missingPage(request);
  let decoded: string[];
  try {
    decoded = segments.map(decodeURIComponent);
  } catch {
    return missingPage(request);
  }
  try {
    // Load server credentials only for paths that can represent a creator or game.
    const { adminGetGame, adminCreatorExists } = await import('@/lib/firebase/admin');
    const [username, slug] = decoded;
    const exists = slug ? await adminGetGame(username, slug) : await adminCreatorExists(username);
    return exists ? NextResponse.next() : missingPage(request);
  } catch (error) {
    console.error('Failed to resolve page:', error);
    // A database outage is not evidence that the requested resource does not exist.
    return new NextResponse(
      'The requested resource could not be checked. Please try again later.\n',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      },
    );
  }
}

// Proxy routes apply apiPolicy themselves: Next's middleware clone waits for request EOF.
// The image optimizer is matched only so limitProxiedImage can charge proxied images per visitor.
export const config = { matcher: ['/((?!_next/|api/proxy/.+).*)', '/_next/image'] };
