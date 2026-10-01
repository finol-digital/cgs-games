import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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
    const response = await fetch(
      url,
      method === 'POST'
        ? {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: await request.text(),
          }
        : undefined,
    );
    if (!response.ok) {
      await response.body?.cancel();
      return apiError('The upstream resource returned an error', response.status, {
        ...corsHeaders,
        ...(response.headers.has('retry-after')
          ? { 'Retry-After': response.headers.get('retry-after')! }
          : {}),
      });
    }
    if (method === 'POST') return response;
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
      },
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return apiError('Failed to fetch the upstream resource', 502, corsHeaders);
  }
}

export async function GET(request: NextRequest) {
  return forward(request, 'GET');
}

export async function POST(request: Request) {
  return forward(request, 'POST');
}
