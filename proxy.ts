import { NextRequest, NextResponse } from 'next/server';
import { apiError, markdownResponse, negotiatePage, notFoundMarkdown } from '@/lib/httpResponses';
import { homepageMarkdown } from '@/lib/siteContent';
import { apiMethods, isPublicFile, staticPaths } from '@/lib/siteRoutes';

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

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/api' || path.startsWith('/api/')) {
    const methods = apiMethods(path);
    if (!methods) return apiError('API endpoint not found', 404);
    if (!methods.includes(request.method)) {
      return apiError('Method not allowed', 405, { Allow: methods.join(', ') });
    }
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          Allow: methods.join(', '),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': methods.join(', '),
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
    return NextResponse.next();
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
  try {
    // Load server credentials only for paths that can represent a creator or game.
    const { adminGetGame, adminCreatorExists } = await import('@/lib/firebase/admin');
    const [username, slug] = segments.map(decodeURIComponent);
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

export const config = { matcher: ['/((?!_next/).*)'] };
