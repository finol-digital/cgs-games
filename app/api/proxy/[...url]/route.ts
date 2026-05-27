import { NextRequest, NextResponse } from 'next/server';

const stripTrailingSlash = (str: string) => {
  return str.endsWith('/') ? str.slice(0, -1) : str;
};

export async function GET(request: NextRequest) {
  const proxyPrefix = '/api/proxy/';
  const rawPath = new URL(request.url).pathname.substring(proxyPrefix.length);
  let uri = stripTrailingSlash('https://' + rawPath);
  if (request.nextUrl.searchParams.size > 0) {
    uri = uri + '?' + request.nextUrl.searchParams.toString();
  }
  const url = new URL(uri);
  console.log('Request /api/proxy GET ' + url);
  const response = await fetch(url);
  return new NextResponse(response.body, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function streamToString(stream: any) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function POST(request: Request) {
  const proxyPrefix = '/api/proxy/';
  const rawPath = new URL(request.url).pathname.substring(proxyPrefix.length);
  let uri = stripTrailingSlash('https://' + rawPath);
  const url = new URL(uri);
  const requestJson = await streamToString(request.body);
  console.log('Request /api/proxy POST ' + url) + ' ' + requestJson;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: requestJson,
  });
  return response;
}
