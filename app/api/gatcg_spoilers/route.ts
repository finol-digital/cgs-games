import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import {
  getCachedSpoilerPayload,
  setCachedSpoilerPayload,
  type CachedSpoilerPayload,
} from '@/lib/firebase/admin';
import { buildSpoilerData } from '@/lib/gatcgSpoilers';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** A fully OCR'd payload is served straight from Firestore for this long. */
const PAYLOAD_FRESH_MS = 15 * 60 * 1000;
/** A payload still missing OCR text is rebuilt sooner so the backlog drains. */
const PARTIAL_PAYLOAD_FRESH_MS = 2 * 60 * 1000;
/** Wall-clock budget for a rebuild, kept well under the platform timeout. */
const REBUILD_BUDGET_MS = 25 * 1000;
/**
 * Warm runs get a far larger budget, but still one that fits inside
 * `maxDuration`: an unbounded run risks being killed mid-build, which would
 * lose the assembled payload even though the per-batch OCR writes survived.
 * Whatever a single run cannot finish is left pending, and the daily workflow
 * retries until nothing is.
 */
const WARM_BUDGET_MS = 240 * 1000;
/** Past this age a cached payload is only used as a fallback on failure. */
const PAYLOAD_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 10, // Max requests per window
  windowMs: 60 * 1000, // 1 minute window
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const authorized = isWarmAuthorized(request);

  // Cache warming: rebuild with a much larger OCR budget to drain the backlog.
  const warm = requestUrl.searchParams.get('warm') === '1';
  // Re-run OCR from scratch; only meaningful together with warm.
  const refreshOcr = requestUrl.searchParams.get('refresh') === '1';
  // Skip the assembled-payload cache, but still use the (cheap) OCR cache.
  // Operators only: bypassing the payload cache forces an upstream fetch and
  // can trigger OCR, which is exactly the load the cache exists to absorb.
  const noCache = requestUrl.searchParams.get('nocache') === '1' && authorized;

  if (warm && !authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  // Warm runs are authorized and deliberately long; don't rate limit them.
  let rateLimitHeaders: Record<string, string> = {};
  if (!warm) {
    const rateLimitResult = checkRateLimit(getClientIp(request), RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
          },
        },
      );
    }

    rateLimitHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
    };
  }

  // Hot path: one Firestore read serves a complete response.
  let cached: CachedSpoilerPayload | null = null;
  if (!noCache && !warm) {
    cached = await getCachedSpoilerPayload();
    if (cached && cached.ageMs < freshnessLimitFor(cached)) {
      return respond(cached.payload, {
        cacheStatus: 'hit',
        pendingOcrCount: cached.pendingOcrCount,
        noStore: false,
        extraHeaders: rateLimitHeaders,
      });
    }
  }

  try {
    const result = await buildSpoilerData({
      deadline: Date.now() + (warm ? WARM_BUDGET_MS : REBUILD_BUDGET_MS),
      refreshOcr: warm && refreshOcr,
    });
    const payload = JSON.stringify(result.data);

    await setCachedSpoilerPayload({
      payload,
      pendingOcrCount: result.ocrPending,
      cardCount: result.cardCount,
    });

    return respond(payload, {
      cacheStatus: warm ? 'warm' : 'miss',
      pendingOcrCount: result.ocrPending,
      noStore: noCache || warm,
      extraHeaders: rateLimitHeaders,
    });
  } catch (error) {
    console.error('Failed to fetch GATCG spoilers:', error);

    // Upstream or OCR failure shouldn't take the endpoint down when we still
    // have a usable payload from a previous build.
    const fallback = cached ?? (await getCachedSpoilerPayload());
    if (fallback && fallback.ageMs < PAYLOAD_MAX_STALE_MS) {
      console.warn(`Serving spoiler payload cached ${Math.round(fallback.ageMs / 1000)}s ago`);
      return respond(fallback.payload, {
        cacheStatus: 'stale',
        pendingOcrCount: fallback.pendingOcrCount,
        noStore: false,
        extraHeaders: rateLimitHeaders,
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch spoiler data' },
      { status: 502, headers: { ...corsHeaders, ...rateLimitHeaders } },
    );
  }
}

/**
 * An incomplete payload is refreshed more eagerly than a complete one, so the
 * remaining cards get OCR'd over the next few requests instead of being pinned
 * for the full freshness window.
 */
function freshnessLimitFor(cached: CachedSpoilerPayload): number {
  return cached.pendingOcrCount > 0 ? PARTIAL_PAYLOAD_FRESH_MS : PAYLOAD_FRESH_MS;
}

function respond(
  payload: string,
  options: {
    cacheStatus: string;
    pendingOcrCount: number;
    noStore: boolean;
    extraHeaders: Record<string, string>;
  },
): NextResponse {
  // Don't let the CDN pin an incomplete payload for long.
  const cacheControl = options.noStore
    ? 'no-store'
    : options.pendingOcrCount > 0
      ? 'public, s-maxage=120, stale-while-revalidate=3600'
      : 'public, s-maxage=900, stale-while-revalidate=86400';

  return new NextResponse(payload, {
    status: 200,
    headers: {
      ...corsHeaders,
      ...options.extraHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      'X-Cache': options.cacheStatus,
      'X-Ocr-Pending': options.pendingOcrCount.toString(),
    },
  });
}

/**
 * Warm runs have no OCR time budget, so they stay behind a shared secret in
 * production. Without a configured token they are allowed only outside
 * production, which is what makes local cache warming convenient.
 */
function isWarmAuthorized(request: Request): boolean {
  const token = process.env.GATCG_WARM_TOKEN;
  if (!token) return process.env.NODE_ENV !== 'production';

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!provided) return false;

  const providedBytes = Buffer.from(provided);
  const tokenBytes = Buffer.from(token);
  if (providedBytes.length !== tokenBytes.length) return false;

  return timingSafeEqual(providedBytes, tokenBytes);
}
