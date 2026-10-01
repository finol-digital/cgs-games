/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as games, POST as publish } from '@/app/api/games/route';
import { GET as browse } from '@/app/api/browse/route';
import { DELETE as remove } from '@/app/api/games/[id]/route';
import { POST as upload } from '@/app/api/games/upload/route';
import { GET as spoilers } from '@/app/api/gatcg_spoilers/route';
import { GET as proxyGet, POST as proxyPost } from '@/app/api/proxy/[...url]/route';
import {
  adminAuth,
  adminDb,
  adminGetAllGames,
  adminStorage,
  getCachedSpoilerPayload,
} from '@/lib/firebase/admin';
import { buildSpoilerData } from '@/lib/gatcgSpoilers';
import { checkRateLimit } from '@/lib/rateLimit';
import { fetchGameSpecification, UnsafeGameUrlError } from '@/lib/fetchGameSpecification';

jest.mock('@/lib/fetchGameSpecification', () => ({
  fetchGameSpecification: jest.fn(),
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
jest.mock('@/lib/rateLimit', () => ({ checkRateLimit: jest.fn(), getClientIp: () => 'test' }));

const documentGet = jest.fn();
const documentDelete = jest.fn();
const documentAdd = jest.fn();
const storedFile = { getMetadata: jest.fn(), delete: jest.fn() };
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
  (adminDb.collection as jest.Mock).mockReturnValue({
    doc: () => ({ get: documentGet, delete: documentDelete }),
    add: documentAdd,
  });
  (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'test-user' });
  (adminStorage.bucket as jest.Mock).mockReturnValue({ file: () => storedFile });
  documentGet.mockResolvedValue({ exists: true, data: () => ({ username: 'creator' }) });
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
    await expectError(limited, 429);
    jest.mocked(buildSpoilerData).mockRejectedValue(new Error('upstream failed'));
    await expectError(await spoilers(new Request('https://cgs.games/api/gatcg_spoilers')), 502);
    jest
      .mocked(getCachedSpoilerPayload)
      .mockResolvedValue({ payload: '{"data":[]}', ageMs: 0, pendingOcrCount: 0, cardCount: 0 });
    expect(
      await (await spoilers(new Request('https://cgs.games/api/gatcg_spoilers'))).json(),
    ).toEqual({ data: [] });
  });

  it.each([proxyGet, proxyPost])(
    'converts upstream HTTP and network errors to JSON',
    async (handler) => {
      const request = new NextRequest('https://cgs.games/api/proxy/example.com/resource');
      global.fetch = jest
        .fn()
        .mockResolvedValue(new Response('<html>Missing</html>', { status: 404 }));
      await expectError(await handler(request), 404);
      global.fetch = jest.fn().mockRejectedValue(new Error('unreachable'));
      await expectError(await handler(request), 502);
    },
  );

  it('preserves proxy success content and GET query parameters', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('image-bytes', { headers: { 'Content-Type': 'image/png' } }));
    const response = await proxyGet(
      new NextRequest('https://cgs.games/api/proxy/example.com/image?alt=media'),
    );
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toBe(
      'https://example.com/image?alt=media',
    );
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(await response.text()).toBe('image-bytes');
  });

  it.each([300, 304])(
    'maps an upstream %i to 502 while retaining retry and CORS headers',
    async (status) => {
      global.fetch = jest
        .fn()
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
});
