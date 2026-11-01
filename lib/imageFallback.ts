import { canLoadImageDirectly } from '@/lib/publicAddress';

// Proxy failures that occur only after the server resolved every redirect hop to public addresses
// and reached an endpoint. Anything else (unsafe destinations, our own rate limit, network errors)
// keeps the image behind the proxy.
const BLOCKED_UPSTREAM_CODES = new Set(['UNSUPPORTED_UPSTREAM_TYPE', 'UPSTREAM_ERROR']);

/** Parses an HTTPS image URL into its normalized form, without a fragment. */
function parseHttpsImageUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    url.hash = '';
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Returns the proxy path for an HTTPS image URL, or null for other URLs. It is built from the
 * normalized URL, which has no dot segments, so the browser requests the same host the URL names.
 */
export function proxyImagePath(value: string): string | null {
  const url = parseHttpsImageUrl(value);
  return url && '/api/proxy/' + url.href.slice('https://'.length);
}

/**
 * Decides whether an image that failed through the proxy may load directly in the visitor's
 * browser, returning the URL to load or null. Some hosts block cgs.games' servers but not
 * browsers. The URL must pass the proxy's own rules, and the proxy must confirm the host was
 * public but refused or served a bad response, and report that it checked exactly the returned URL.
 */
export async function directImageFallback(value: string): Promise<string | null> {
  const url = parseHttpsImageUrl(value);
  if (!url || !canLoadImageDirectly(url.href)) return null;
  // The proxy drops a trailing slash, so it would check a different resource than the browser loads.
  if (url.pathname.endsWith('/')) return null;
  try {
    const response = await fetch(proxyImagePath(url.href)!, { cache: 'no-store' });
    if (response.ok) {
      await response.body?.cancel();
      return null;
    }
    // However the path was normalized on the way, the proxy must have checked exactly this URL.
    if (response.headers.get('x-proxy-upstream-url') !== url.href) {
      await response.body?.cancel();
      return null;
    }
    const body: unknown = await response.json();
    const code = typeof body === 'object' && body !== null && (body as { code?: unknown }).code;
    return BLOCKED_UPSTREAM_CODES.has(String(code)) ? url.href : null;
  } catch {
    return null;
  }
}
