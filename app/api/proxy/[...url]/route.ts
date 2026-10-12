import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';
import { fetchPublicResource, UnsafeGameUrlError } from '@/lib/fetchGameSpecification';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  // An upstream HTML/SVG document must never execute with CGS's Firebase session.
  'Content-Security-Policy': "sandbox; default-src 'none'",
  'X-Content-Type-Options': 'nosniff',
};

/** Forwards an HTTPS request, preserving successes and normalizing upstream failures. */
async function forward(request: Request, method: 'GET' | 'POST') {
  let url: URL;
  try {
    const incoming = new URL(request.url);
    const rawPath = incoming.pathname.substring('/api/proxy/'.length).replace(/\/$/, '');
    url = new URL('https://' + rawPath);
    // Preserve the existing GET query forwarding and POST JSON behavior.
    if (method === 'GET') url.search = incoming.search;
  } catch {
    return apiError('Invalid proxy URL', 400, corsHeaders);
  }
  try {
    const body = method === 'POST' ? await request.text() : undefined;
    if (body && Buffer.byteLength(body) > 16 * 1024 * 1024) {
      return apiError('Proxy request exceeds 16 MiB', 413, corsHeaders);
    }
    const response = await fetchPublicResource(url.href, {
      method,
      body,
      maxBytes: 100 * 1024 * 1024,
      accept: '*/*',
    });
    if (!response.ok) {
      await response.body?.cancel();
      const status = response.status >= 400 ? response.status : 502;
      return apiError(
        'The upstream resource returned an error',
        status,
        {
          ...corsHeaders,
          ...(response.headers.has('retry-after')
            ? { 'Retry-After': response.headers.get('retry-after')! }
            : {}),
        },
        {
          code: 'UPSTREAM_ERROR',
          hint: 'Check access to the upstream resource or try again later; authenticating to this proxy does not authenticate upstream.',
        },
      );
    }
    const headers = new Headers(corsHeaders);
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    headers.set('Content-Type', contentType);
    const encoding = response.headers.get('content-encoding');
    if (encoding) headers.set('Content-Encoding', encoding);
    if (method === 'POST') headers.set('Cache-Control', 'no-store');
    if (method === 'GET' && contentType.toLowerCase().startsWith('image/')) {
      // Retain upstream restrictions and validators instead of dropping them.
      for (const name of ['cache-control', 'expires', 'etag', 'last-modified', 'age', 'vary']) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
      }
      // Only plain public image URLs get a default lifetime. Tokenized images,
      // varying responses and cookie-setting responses must opt in upstream.
      if (
        !headers.has('cache-control') &&
        !headers.has('expires') &&
        !headers.has('vary') &&
        !response.headers.has('set-cookie') &&
        !url.search
      ) {
        headers.set('Cache-Control', 'public, max-age=3600');
      }
    }
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    if (error instanceof UnsafeGameUrlError)
      return apiError('Use a public HTTPS resource on port 443', 400, corsHeaders);
    console.error('Proxy request failed:', error);
    return apiError('Failed to fetch the upstream resource', 502, corsHeaders);
  }
}

/** Proxies a public resource with its original media type and GET query parameters. */
export async function GET(request: NextRequest) {
  return forward(request, 'GET');
}

/** Forwards a JSON POST body and normalizes unsuccessful upstream responses. */
export async function POST(request: Request) {
  return forward(request, 'POST');
}
