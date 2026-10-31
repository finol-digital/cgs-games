/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as games, POST as publish } from '@/app/api/games/route';
import { GET as browse } from '@/app/api/browse/route';
import { DELETE as remove } from '@/app/api/games/[id]/route';
import { POST as upload } from '@/app/api/games/upload/route';
import { GET as spoilers } from '@/app/api/gatcg_spoilers/route';
import {
  GET as proxyGet,
  POST as proxyPost,
  HEAD as proxyHead,
  OPTIONS as proxyOptions,
  DELETE as proxyDelete,
} from '@/app/api/proxy/[...url]/route';
import {
  adminAuth,
  adminDb,
  adminGetAllGames,
  adminStorage,
  getCachedSpoilerPayload,
} from '@/lib/firebase/admin';
import { buildSpoilerData } from '@/lib/gatcgSpoilers';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  fetchGameSpecification,
  fetchPublicResource,
  UnsafeGameUrlError,
} from '@/lib/fetchGameSpecification';

jest.mock('@/lib/fetchGameSpecification', () => ({
  fetchGameSpecification: jest.fn(),
  fetchPublicResource: jest.fn(),
  UnsafeGameUrlError: class extends Error {},
}));

jest.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifyIdToken: jest.fn() },
  adminDb: { collection: jest.fn() },
  adminStorage: { bucket: jest.fn() },
  adminGetAllGames: jest.fn(),
  getCachedSpoilerPayload: jest.fn(),
  setCachedSpoilerPayload: jest.fn(),
}));
jest.mock('@/lib/gatcgSpoilers', () => ({ buildSpoilerData: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  ...jest.requireActual('@/lib/rateLimit'),
  checkRateLimit: jest.fn(),
  getClientIp: () => 'test',
}));

const documentGet = jest.fn();
const documentDelete = jest.fn();
const documentAdd = jest.fn();
const storedFile = { getMetadata: jest.fn(), delete: jest.fn() };
const query = { where: jest.fn(), get: jest.fn(), count: jest.fn() };
let gameCount = 0;
const originalFetch = global.fetch;
let errorLog: jest.SpyInstance;
let infoLog: jest.SpyInstance;

/** Builds a JSON API request with an optional bearer token. */
const makeRequest = (path: string, body?: string, token?: string) =>
  new Request('https://cgs.games' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body,
  });
/** Asserts the backwards-compatible error envelope and its HTTP status. */
async function expectError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  const body = await response.json();
  expect(body).toEqual({
    error: expect.any(String),
    code: expect.any(String),
    message: expect.any(String),
    hint: expect.any(String),
  });
  expect(body.error).toBe(body.message);
  expect(body.hint.length).toBeGreaterThan(10);
}

beforeEach(() => {
  jest.resetAllMocks();
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  infoLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  query.where.mockReturnValue(query);
  query.get.mockResolvedValue({ empty: true });
  query.count.mockReturnValue({ get: async () => ({ data: () => ({ count: gameCount }) }) });
  gameCount = 0;
  (adminDb.collection as jest.Mock).mockReturnValue({
    doc: () => ({ get: documentGet, delete: documentDelete }),
    add: documentAdd,
    where: query.where,
  });
  (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'test-user' });
  (adminStorage.bucket as jest.Mock).mockReturnValue({ file: () => storedFile });
  documentGet.mockResolvedValue({
    exists: true,
    data: () => ({ username: 'creator', uid: 'test-user' }),
  });
  jest
    .mocked(checkRateLimit)
    .mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 });
  jest.mocked(getCachedSpoilerPayload).mockResolvedValue(null);
});
afterEach(() => {
  global.fetch = originalFetch;
  errorLog.mockRestore();
  infoLog.mockRestore();
});

describe('API response contract', () => {
  it('enforces version, method and preflight policy locally without fetching upstream', async () => {
    const url = 'https://cgs.games/api/proxy/example.com/resource';
    const unsupported = await proxyPost(
      new Request(url, { method: 'POST', headers: { 'API-Version': '2' } }),
    );
    expect(unsupported.status).toBe(400);
    expect((await unsupported.json()).code).toBe('UNSUPPORTED_API_VERSION');
    const denied = proxyDelete(new Request(url, { method: 'DELETE' }));
    expect(denied.status).toBe(405);
    expect(denied.headers.get('allow')).toBe('GET, HEAD, POST, OPTIONS');
    const preflight = proxyOptions(new Request(url, { method: 'OPTIONS' }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('API-Version');
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it('cancels HEAD bodies and preserves API version and upstream Vary headers', async () => {
    const cancel = jest.fn();
    jest.mocked(fetchPublicResource).mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        headers: { 'Content-Type': 'image/png', Vary: 'Cookie' },
      }),
    );
    const response = await proxyHead(
      new Request('https://cgs.games/api/proxy/example.com/image', { method: 'HEAD' }),
    );
    expect(response.body).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.headers.get('api-version')).toBe('1');
    expect(response.headers.get('vary')).toBe('Cookie, API-Version');
    expect(response.headers.get('access-control-expose-headers')).toContain('API-Version');
  });
  it.each([proxyGet, proxyPost])(
    'sandboxes upstream content without forwarding cookies',
    async (handler) => {
      jest.mocked(fetchPublicResource).mockResolvedValue(
        new Response('<script>attack()</script>', {
          headers: { 'Content-Type': 'text/plain', 'Set-Cookie': 'session=attacker' },
        }),
      );
      const response = await handler(
        new NextRequest('https://cgs.games/api/proxy/example.com/page'),
      );
      expect(response.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'");
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.has('set-cookie')).toBe(false);
      expect(await response.text()).toBe('<script>attack()</script>');
    },
  );

  it.each(['text/html; charset=utf-8', 'image/svg+xml', 'application/xml', 'application/pdf'])(
    'refuses to serve %s documents under the cgs.games origin',
    async (contentType) => {
      const cancel = jest.fn();
      jest.mocked(fetchPublicResource).mockResolvedValue(
        new Response(new ReadableStream({ cancel }), {
          headers: { 'Content-Type': contentType },
        }),
      );
      const response = await proxyGet(
        new NextRequest('https://cgs.games/api/proxy/example.com/phish'),
      );
      await expectError(response.clone(), 502);
      expect((await response.json()).code).toBe('UNSUPPORTED_UPSTREAM_TYPE');
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it('serves game data types and forces binary archives to download', async () => {
    for (const [contentType, disposition] of [
      ['application/json; charset=utf-8', null],
      ['application/vnd.api+json', null],
      ['text/csv', null],
      ['image/webp', null],
      ['application/zip', 'attachment'],
      ['application/octet-stream', 'attachment'],
    ]) {
      jest
        .mocked(fetchPublicResource)
        .mockResolvedValue(new Response('data', { headers: { 'Content-Type': contentType! } }));
      const response = await proxyGet(
        new NextRequest('https://cgs.games/api/proxy/example.com/resource'),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-disposition')).toBe(disposition);
    }
  });

  it('rate limits proxy clients with retry guidance and no upstream request', async () => {
    jest
      .mocked(checkRateLimit)
      .mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 });
    const response = await proxyGet(
      new NextRequest('https://cgs.games/api/proxy/example.com/image.png'),
    );
    await expectError(response.clone(), 429);
    expect(response.headers.get('retry-after')).toBeTruthy();
    expect(response.headers.get('ratelimit-policy')).toContain('"proxy"');
    expect(checkRateLimit).toHaveBeenCalledWith('proxy:test', expect.any(Object));
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it.each([proxyGet, proxyPost])('rejects unsafe proxy targets', async (handler) => {
    jest.mocked(fetchPublicResource).mockRejectedValue(new UnsafeGameUrlError('Private IP'));
    await expectError(
      await handler(new NextRequest('https://cgs.games/api/proxy/127.0.0.1/')),
      400,
    );
  });

  it('does not forward the caller credentials or cookies to a proxy destination', async () => {
    jest.mocked(fetchPublicResource).mockResolvedValue(Response.json({ ok: true }));
    const response = await proxyPost(
      new Request('https://cgs.games/api/proxy/example.com/resource', {
        method: 'POST',
        headers: { Authorization: 'Bearer private', Cookie: 'private=value' },
        body: '{}',
      }),
    );
    expect(fetchPublicResource).toHaveBeenCalledWith('https://example.com/resource', {
      method: 'POST',
      body: '{}',
      accept: '*/*',
      maxBytes: 100 * 1024 * 1024,
      stream: true,
      signal: expect.any(AbortSignal),
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects oversized proxy POST bodies before opening an upstream connection', async () => {
    const response = await proxyPost(
      new Request('https://cgs.games/api/proxy/example.com/resource', {
        method: 'POST',
        body: 'x'.repeat(16 * 1024 * 1024 + 1),
      }),
    );
    expect(response.status).toBe(413);
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });
  it.each([games, browse])(
    'returns JSON catalog successes and caught failures',
    async (handler) => {
      jest.mocked(adminGetAllGames).mockResolvedValue([]);
      const response = await handler();
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(await response.json()).toEqual([]);
      jest.mocked(adminGetAllGames).mockRejectedValue(new Error('private database failure'));
      await expectError(await handler(), 500);
    },
  );

  it('reports publication authentication, input, and upstream errors', async () => {
    await expectError(await publish(makeRequest('/api/games', '{}')), 401);
    await expectError(await publish(makeRequest('/api/games', '{', 'token')), 400);
    await expectError(await publish(makeRequest('/api/games', 'null', 'token')), 400);
    await expectError(await publish(makeRequest('/api/games', '{}', 'token')), 400);
    const request = () =>
      makeRequest(
        '/api/games',
        JSON.stringify({ autoUpdateUrl: 'https://example.com/cgs.json' }),
        'token',
      );
    (adminAuth.verifyIdToken as jest.Mock).mockRejectedValueOnce(new Error('expired'));
    await expectError(await publish(request()), 401);
    documentGet.mockResolvedValueOnce({ exists: false });
    await expectError(await publish(request()), 404);
    documentGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
    await expectError(await publish(request()), 400);
    jest.mocked(fetchGameSpecification).mockResolvedValue(new Response('', { status: 404 }));
    await expectError(await publish(request()), 502);
    jest
      .mocked(fetchGameSpecification)
      .mockResolvedValue(
        Response.json({ name: 'Test', bannerImageUrl: 'http://invalid.example/image.png' }),
      );
    await expectError(await publish(request()), 400);
    jest.mocked(fetchGameSpecification).mockRejectedValue(new Error('internal secret'));
    const failed = await publish(request());
    expect(await failed.clone().text()).not.toContain('internal secret');
    await expectError(failed, 502);
    jest
      .mocked(fetchGameSpecification)
      .mockRejectedValue(new UnsafeGameUrlError('Public HTTPS required'));
    await expectError(await publish(request()), 400);
  });

  it('preserves the publish success response', async () => {
    jest.mocked(fetchGameSpecification).mockResolvedValue(Response.json({ name: 'Test Game' }));
    const result = await publish(
      makeRequest('/api/games', '{"autoUpdateUrl":"https://example.com/cgs.json"}', 'token'),
    );
    expect(await result.json()).toEqual({ success: true, slug: 'test_game' });
    expect(documentAdd).toHaveBeenCalled();
  });

  it.each([
    { name: { toString: 'x' } },
    { name: ['Game'] },
    { name: '   ' },
    { name: 'x'.repeat(201) },
    { name: 'Game', copyright: { owner: 'x' } },
    { name: 'Game', copyright: 7 },
    { name: 'Game', copyright: 'x'.repeat(501) },
  ])('refuses specification metadata that shared pages cannot render: %j', async (spec) => {
    jest.mocked(fetchGameSpecification).mockResolvedValue(Response.json(spec));
    const result = await publish(
      makeRequest('/api/games', '{"autoUpdateUrl":"https://example.com/cgs.json"}', 'token'),
    );
    await expectError(result, 400);
    expect(documentAdd).not.toHaveBeenCalled();
  });

  it('refuses non-object specifications and oversized URLs', async () => {
    jest.mocked(fetchGameSpecification).mockResolvedValue(Response.json(['Game']));
    const publishUrl = (url: string) =>
      publish(makeRequest('/api/games', JSON.stringify({ autoUpdateUrl: url }), 'token'));
    await expectError(await publishUrl('https://example.com/cgs.json'), 400);
    await expectError(await publishUrl('https://example.com/' + 'x'.repeat(2048)), 400);
    expect(documentAdd).not.toHaveBeenCalled();
  });

  it('rejects a duplicate URL listing and enforces the per-creator game quota', async () => {
    jest
      .mocked(fetchGameSpecification)
      .mockImplementation(async () => Response.json({ name: 'Test Game' }));
    const request = () =>
      makeRequest('/api/games', '{"autoUpdateUrl":"https://example.com/cgs.json"}', 'token');
    query.get.mockResolvedValueOnce({ empty: false });
    await expectError(await publish(request()), 409);
    gameCount = 50;
    const limited = await publish(request());
    await expectError(limited.clone(), 403);
    expect((await limited.json()).code).toBe('GAME_QUOTA_EXCEEDED');
    expect(documentAdd).not.toHaveBeenCalled();
    expect(query.where).toHaveBeenCalledWith('username', '==', 'creator');
    expect(query.where).toHaveBeenCalledWith('slug', '==', 'test_game');
  });

  it('returns JSON deletion errors and preserves the text success', async () => {
    const context = { params: Promise.resolve({ id: 'game-id' }) };
    await expectError(await remove(makeRequest('/api/games/game-id'), context), 401);
    const request = () => makeRequest('/api/games/game-id', undefined, 'token');
    (adminAuth.verifyIdToken as jest.Mock).mockRejectedValueOnce(new Error('expired'));
    await expectError(await remove(request(), context), 401);
    documentGet.mockResolvedValueOnce({ exists: false });
    await expectError(await remove(request(), context), 404);
    documentGet.mockResolvedValueOnce({ exists: true, data: () => ({ username: 'other-owner' }) });
    await expectError(await remove(request(), context), 403);
    documentGet.mockRejectedValueOnce(new Error('offline'));
    await expectError(await remove(request(), context), 500);
    const success = await remove(request(), context);
    expect(await success.text()).toBe('Game deleted successfully');
  });

  it('returns JSON upload errors, including asynchronous processing failures', async () => {
    await expectError(await upload(makeRequest('/api/games/upload', '{}')), 401);
    await expectError(await upload(makeRequest('/api/games/upload', '{', 'token')), 400);
    await expectError(await upload(makeRequest('/api/games/upload', '{}', 'token')), 400);
    storedFile.getMetadata.mockRejectedValue(new Error('private storage failure'));
    const staged = makeRequest(
      '/api/games/upload',
      JSON.stringify({
        stagedPath: 'staged-uploads/test-user/archive.cgs.zip',
        originalFilename: 'game.cgs.zip',
      }),
      'token',
    );
    await expectError(await upload(staged), 500);
    expect(storedFile.delete).toHaveBeenCalled();
    storedFile.getMetadata.mockResolvedValue([{ size: 104857601 }]);
    await expectError(
      await upload(
        makeRequest(
          '/api/games/upload',
          JSON.stringify({
            stagedPath: 'staged-uploads/test-user/archive.cgs.zip',
            originalFilename: 'game.cgs.zip',
          }),
          'token',
        ),
      ),
      413,
    );
  });

  it('keeps spoiler authorization, rate limits and upstream failures machine-readable', async () => {
    const previousToken = process.env.GATCG_WARM_TOKEN;
    process.env.GATCG_WARM_TOKEN = 'operator-token';
    try {
      await expectError(
        await spoilers(new Request('https://cgs.games/api/gatcg_spoilers?warm=1')),
        401,
      );
    } finally {
      if (previousToken === undefined) delete process.env.GATCG_WARM_TOKEN;
      else process.env.GATCG_WARM_TOKEN = previousToken;
    }
    jest
      .mocked(checkRateLimit)
      .mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
    const limited = await spoilers(new Request('https://cgs.games/api/gatcg_spoilers'));
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect(limited.headers.get('ratelimit')).toMatch(/^"spoilers";r=0;t=\d+$/);
    expect(limited.headers.get('ratelimit-policy')).toBe('"spoilers";q=10;w=60');
    await expectError(limited, 429);
    jest.mocked(buildSpoilerData).mockRejectedValue(new Error('upstream failed'));
    await expectError(await spoilers(new Request('https://cgs.games/api/gatcg_spoilers')), 502);
    jest
      .mocked(getCachedSpoilerPayload)
      .mockResolvedValue({ payload: '{"data":[]}', ageMs: 0, pendingOcrCount: 0, cardCount: 0 });
    const cached = await spoilers(new Request('https://cgs.games/api/gatcg_spoilers'));
    expect(await cached.json()).toEqual({ data: [] });
    expect(cached.headers.get('ratelimit-policy')).toBe('"spoilers";q=10;w=60');
    expect(cached.headers.get('ratelimit')).toMatch(/^"spoilers";r=\d+;t=\d+$/);
    expect(cached.headers.get('cache-control')).toBe('no-store');
  });

  it.each([proxyGet, proxyPost])(
    'converts upstream HTTP and network errors to JSON',
    async (handler) => {
      const request = new NextRequest('https://cgs.games/api/proxy/example.com/resource');
      jest
        .mocked(fetchPublicResource)
        .mockResolvedValue(new Response('<html>Missing</html>', { status: 404 }));
      await expectError(await handler(request), 404);
      jest.mocked(fetchPublicResource).mockRejectedValue(new Error('unreachable'));
      await expectError(await handler(request), 502);
    },
  );

  it('preserves proxy success content and GET query parameters', async () => {
    jest
      .mocked(fetchPublicResource)
      .mockResolvedValue(new Response('image-bytes', { headers: { 'Content-Type': 'image/png' } }));
    const response = await proxyGet(
      new NextRequest('https://cgs.games/api/proxy/example.com/image?alt=media'),
    );
    expect(String((fetchPublicResource as jest.Mock).mock.calls[0][0])).toBe(
      'https://example.com/image?alt=media',
    );
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(await response.text()).toBe('image-bytes');
  });

  it('caches public images for an hour and retains upstream cache restrictions', async () => {
    const request = new NextRequest('https://cgs.games/api/proxy/example.com/banner.png');
    jest
      .mocked(fetchPublicResource)
      .mockResolvedValue(new Response('image', { headers: { 'Content-Type': 'image/png' } }));
    expect((await proxyGet(request)).headers.get('cache-control')).toBe('public, max-age=3600');

    jest.mocked(fetchPublicResource).mockResolvedValue(
      new Response('image', {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, no-store',
          ETag: '"banner-v2"',
          'Last-Modified': 'Sun, 11 Oct 2026 00:00:00 GMT',
        },
      }),
    );
    const response = await proxyGet(request);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('etag')).toBe('"banner-v2"');
    expect(response.headers.get('last-modified')).toBe('Sun, 11 Oct 2026 00:00:00 GMT');
    expect(await response.text()).toBe('image');
  });

  it.each([
    ['application/json', '', {}],
    ['image/png', '?alt=media&token=secret', {}],
    ['image/png', '', { Vary: 'Cookie' }],
    ['image/png', '', { 'Set-Cookie': 'session=value' }],
    ['image/png', '', { Expires: 'Sun, 11 Oct 2026 00:00:00 GMT' }],
  ])('does not invent public caching for %s %s %j', async (type, query, extraHeaders) => {
    jest
      .mocked(fetchPublicResource)
      .mockResolvedValue(
        new Response('content', { headers: { 'Content-Type': type, ...extraHeaders } }),
      );
    const response = await proxyGet(
      new NextRequest('https://cgs.games/api/proxy/example.com/resource' + query),
    );
    expect(response.headers.has('cache-control')).toBe(false);
  });

  it.each([300, 304])(
    'maps an upstream %i to 502 while retaining retry and CORS headers',
    async (status) => {
      jest
        .mocked(fetchPublicResource)
        .mockResolvedValue(new Response(null, { status, headers: { 'Retry-After': '60' } }));
      const response = await proxyGet(
        new NextRequest('https://cgs.games/api/proxy/example.com/resource'),
      );
      expect(response.status).toBe(502);
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect((await response.json()).code).toBe('UPSTREAM_ERROR');
    },
  );

  it.each([401, 403, 404, 429, 500])(
    'keeps upstream %i distinct from local API errors',
    async (status) => {
      jest.mocked(fetchPublicResource).mockResolvedValue(new Response(null, { status }));
      const response = await proxyGet(
        new NextRequest('https://cgs.games/api/proxy/example.com/resource'),
      );
      expect(response.status).toBe(status);
      const body = await response.json();
      expect(body.code).toBe('UPSTREAM_ERROR');
      expect(body.hint).toContain('upstream resource');
      expect(body.hint).not.toContain('Provide a valid Bearer token');
    },
  );
});
