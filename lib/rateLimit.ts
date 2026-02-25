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
    keysToDelete.forEach((k) => requestCounts.delete(k));
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
 * Extract client IP from request headers
 * Supports various proxy headers commonly used in production
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Check common proxy headers in order of preference
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = forwardedFor.split(',');
    return ips[ips.length - 1].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to 'unknown' if no IP found
  return 'unknown';
}
