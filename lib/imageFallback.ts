import { canLoadImageDirectly } from '@/lib/publicAddress';

// Proxy failures that occur only after the server resolved every redirect hop to public addresses
// and reached an endpoint. Anything else (unsafe destinations, our own rate limit, network errors)
// keeps the image behind the proxy.
const BLOCKED_UPSTREAM_CODES = new Set(['UNSUPPORTED_UPSTREAM_TYPE', 'UPSTREAM_ERROR']);

/**
 * Decides whether an image that failed through the proxy may load directly in the visitor's
 * browser. Some hosts block cgs.games' servers but not browsers. The URL must pass the proxy's
 * own rules, and the proxy must confirm the host was public but refused or served a bad response.
 */
export async function canFallBackToDirectImage(
  directUrl: string,
  proxyPath: string,
): Promise<boolean> {
  if (!canLoadImageDirectly(directUrl)) return false;
  try {
    const response = await fetch(proxyPath, { cache: 'no-store' });
    if (response.ok) {
      await response.body?.cancel();
      return false;
    }
    const body: unknown = await response.json();
    return (
      typeof body === 'object' &&
      body !== null &&
      BLOCKED_UPSTREAM_CODES.has(String((body as { code?: unknown }).code))
    );
  } catch {
    return false;
  }
}
