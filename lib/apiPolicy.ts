import { NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';
import { apiMethods } from '@/lib/siteRoutes';

/** Applies identical API policy in middleware and routes that must bypass body cloning. */
export function apiPolicy(request: Request): {
  headers: Record<string, string>;
  response?: NextResponse;
} {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, API-Version',
    'Access-Control-Expose-Headers':
      'API-Version, RateLimit, RateLimit-Policy, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Cache, X-Ocr-Pending, Deprecation, Sunset, Link',
    'API-Version': '1',
    Vary: 'API-Version',
  };
  const methods = apiMethods(new URL(request.url).pathname);
  if (!methods) return { headers, response: apiError('API endpoint not found', 404, headers) };
  headers['Access-Control-Allow-Methods'] = methods.join(', ');
  if (!methods.includes(request.method))
    return {
      headers,
      response: apiError('Method not allowed', 405, { ...headers, Allow: methods.join(', ') }),
    };
  if (request.method === 'OPTIONS')
    return {
      headers,
      response: new NextResponse(null, {
        status: 204,
        headers: { ...headers, Allow: methods.join(', ') },
      }),
    };
  const version = request.headers.get('api-version');
  if (version !== null && version !== '1')
    return {
      headers,
      response: apiError('Unsupported API version', 400, headers, {
        code: 'UNSUPPORTED_API_VERSION',
        hint: 'Send API-Version: 1 or omit the header. See /developers#versioning.',
      }),
    };
  return { headers };
}
