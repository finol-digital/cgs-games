// Simple in-memory rate limiter for API endpoints
// Tracks requests by IP address and enforces limits per time window

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const requestCounts = new Map<string, RateLimitStore>();

export interface RateLimitConfig {
  maxRequests: number; // Maximum number of requests allowed
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** IETF draft-ietf-httpapi-ratelimit-headers-11 structured fields, plus legacy compatibility. */
export function rateLimitResponseHeaders(
  result: RateLimitResult,
  config: RateLimitConfig,
  policy = 'spoilers',
): Record<string, string> {
  const resetSeconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
  return {
    'RateLimit-Policy': `"${policy}";q=${config.maxRequests};w=${Math.ceil(config.windowMs / 1000)}`,
    RateLimit: `"${policy}";r=${Math.max(0, result.remaining)};t=${resetSeconds}`,
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    ...(!result.allowed ? { 'Retry-After': Math.max(1, resetSeconds).toString() } : {}),
  };
}

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier (typically IP address)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed and rate limit info
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const store = requestCounts.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    const keysToDelete: string[] = [];
    requestCounts.forEach((v, k) => {
      if (v.resetAt < now) {
        keysToDelete.push(k);
      }
    });
    for (const k of keysToDelete) {
      requestCounts.delete(k);
    }
  }

  if (!store || store.resetAt < now) {
    // First request or window expired - create new entry
    requestCounts.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (store.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: store.resetAt,
    };
  }

  // Increment count and allow request
  store.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - store.count,
    resetAt: store.resetAt,
  };
}

/**
 * Basic sanitization and validation for IP address strings.
 * - Trims whitespace
 * - Strips optional port (e.g. "1.2.3.4:1234" or "[::1]:1234")
 * - Ensures the result looks like an IPv4 or IPv6 literal
 */
function sanitizeIp(ip: string | null): string | null {
  if (!ip) {
    return null;
  }

  const trimmed = ip.trim();
  if (!trimmed || trimmed.length > 45) {
    // 45 chars is enough for the longest IPv6 literal
    return null;
  }

  // Strip port if present
  let withoutPort = trimmed;
  // [::1]:3000 -> ::1
  const ipv6PortMatch = /^\[([^\]]+)\](?::\d+)?$/.exec(withoutPort);
  if (ipv6PortMatch) {
    withoutPort = ipv6PortMatch[1];
  } else {
    // 192.0.2.1:3000 -> 192.0.2.1
    const ipv4PortMatch = /^([^:]+)(?::\d+)$/.exec(withoutPort);
    if (ipv4PortMatch) {
      withoutPort = ipv4PortMatch[1];
    }
  }

  const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;

  if (ipv4Regex.test(withoutPort) || ipv6Regex.test(withoutPort)) {
    return withoutPort;
  }

  return null;
}

let warnedMissingPlatformIp = false;

/**
 * Extract client IP from the request, using only values a client cannot choose.
 *
 * Firebase App Hosting sets x-fah-client-ip to the connecting client's address. Elsewhere, the
 * rightmost X-Forwarded-For entry is the one appended by the nearest proxy; every entry to its
 * left, and headers such as X-Real-IP, can be supplied by the client to evade rate limits.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const candidates: string[] = [];

  const appHostingIp = headers.get('x-fah-client-ip');
  if (appHostingIp) {
    candidates.push(appHostingIp);
  } else if (process.env.K_SERVICE && !warnedMissingPlatformIp) {
    // On Cloud Run the rightmost X-Forwarded-For hop can be a shared Google front end, which
    // would make many clients share one rate-limit bucket. Surface it rather than fail silently.
    warnedMissingPlatformIp = true;
    console.warn('x-fah-client-ip is missing; rate limits fall back to X-Forwarded-For');
  }

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const last = forwardedFor.split(',').at(-1)?.trim();
    if (last) {
      candidates.push(last);
    }
  }

  for (const candidate of candidates) {
    const sanitized = sanitizeIp(candidate);
    if (sanitized) {
      return sanitized;
    }
  }

  // Fallback to 'unknown' if no valid IP found
  return 'unknown';
}
