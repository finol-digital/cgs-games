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

/**
 * Extract client IP from the request.
 * Prefers platform-provided values (e.g. NextRequest.ip) and
 * falls back to common proxy headers, with basic sanitization.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const candidates: string[] = [];

  // Prefer Next.js / platform-provided IP if available
  const maybeIp = (request as any)?.ip;
  if (typeof maybeIp === 'string') {
    candidates.push(maybeIp);
  }

  // Common platform headers (these are typically set by the host, not the client)
  const vercelIp = headers.get('x-vercel-ip');
  if (vercelIp) {
    candidates.push(vercelIp);
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    candidates.push(cfConnectingIp);
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    candidates.push(realIp);
  }

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      candidates.push(first);
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
