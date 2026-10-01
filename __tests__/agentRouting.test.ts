/** @jest-environment node */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { negotiatePage, apiError } from '@/lib/httpResponses';
import { adminCreatorExists, adminGetGame } from '@/lib/firebase/admin';
import { staticPaths } from '@/lib/siteRoutes';

jest.mock('@/lib/firebase/admin', () => ({
  adminCreatorExists: jest.fn(),
  adminGetGame: jest.fn(),
}));

/** Builds a page or API request without contacting a server. */
const request = (path: string, accept = 'text/html', method = 'GET') =>
  new NextRequest('https://cgs.games' + path, { method, headers: { accept } });

describe('page negotiation and missing routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it.each([
    [null, 'html'],
    ['', 'html'],
    ['*/*', 'html'],
    ['text/*', 'html'],
    ['text/html', 'html'],
    ['text/markdown', 'markdown'],
    ['text/markdown;q=0.9,text/html;q=0.2', 'markdown'],
    ['text/markdown;q=0.2,text/html;q=0.9', 'html'],
    ['text/markdown;q=0,*/*;q=1', 'html'],
    ['text/html;q=0,text/*;q=0.8', 'markdown'],
    ['text/markdown;q=0,text/html;q=0', null],
    ['application/json', null],
    ['text/markdown;q=2', null],
    ['TEXT/MARKDOWN;Q=1', 'markdown'],
    ['text/html,text/markdown', 'html'],
  ])('negotiates %s as %s', (accept, expected) => {
    expect(negotiatePage(accept)).toBe(expected);
  });

  it('serves a nonempty Markdown homepage on the homepage URL', async () => {
    const response = await proxy(request('/', 'text/markdown'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/markdown/);
    expect(response.headers.get('vary')).toContain('Accept');
    expect(await response.text()).toContain('# CGS Games');
  });

  it('preserves HTML, RSC navigation and unsupported-type handling', async () => {
    const html = await proxy(request('/'));
    expect(html.headers.get('x-middleware-next')).toBe('1');
    expect(html.headers.get('vary')).toContain('Accept');
    expect((await proxy(request('/', 'application/json'))).status).toBe(406);
    const flight = request('/', 'text/x-component');
    flight.headers.set('rsc', '1');
    expect((await proxy(flight)).headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['/no-such-creator', '/no-such-creator/no-game', '/not/a/real/page', '/missing.png'])(
    'returns Markdown 404 for %s',
    async (path) => {
      const response = await proxy(request(path, 'text/markdown'));
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toMatch(/^text\/markdown/);
      expect(response.headers.get('vary')).toContain('Accept');
      const body = await response.text();
      expect(body.length).toBeGreaterThan(20);
      expect(body).toContain('https://cgs.games/llms.txt');
    },
  );

  it('sets an HTML 404 before rendering the error page', async () => {
    const response = await proxy(request('/no-such-creator'));
    expect(response.status).toBe(404);
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://cgs.games/404');
  });

  it.each(['text/html', 'text/markdown'])(
    'returns 404 for malformed encoding with %s',
    async (accept) => {
      const response = await proxy(request('/%E0%A4%A', accept));
      expect(response.status).toBe(404);
      expect(response.headers.has('retry-after')).toBe(false);
      expect(adminCreatorExists).not.toHaveBeenCalled();
      expect(adminGetGame).not.toHaveBeenCalled();
    },
  );

  it('preserves existing creators, games, and static resources', async () => {
    jest.mocked(adminCreatorExists).mockResolvedValue(true);
    jest
      .mocked(adminGetGame)
      .mockResolvedValue({ id: 'exists' } as Awaited<ReturnType<typeof adminGetGame>>);
    for (const path of [...Array.from(staticPaths), '/creator', '/creator/game']) {
      expect((await proxy(request(path))).headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('does not misreport a database failure as a missing page', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(adminCreatorExists).mockRejectedValue(new Error('offline'));
    expect((await proxy(request('/creator'))).status).toBe(503);
    log.mockRestore();
  });

  it('returns structured JSON for unknown APIs regardless of Accept', async () => {
    const response = await proxy(request('/api/no-such-endpoint', 'text/markdown'));
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject({
      code: 'NOT_FOUND',
      hint: expect.any(String),
      message: expect.any(String),
    });
  });

  it('returns JSON 405 with Allow and preserves preflight', async () => {
    const response = await proxy(request('/api/games/upload', 'application/json'));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST, OPTIONS');
    expect((await response.json()).code).toBe('METHOD_NOT_ALLOWED');
    const preflightRequest = request('/api/games/upload', '*/*', 'OPTIONS');
    preflightRequest.headers.set('Origin', 'https://cgs.gg');
    preflightRequest.headers.set('Access-Control-Request-Method', 'POST');
    preflightRequest.headers.set('Access-Control-Request-Headers', 'Content-Type, Authorization');
    const preflight = await proxy(preflightRequest);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization',
    );
  });

  it('retains error strings, CORS and retry headers with machine-readable fields', async () => {
    const response = apiError('Slow down', 429, {
      'Retry-After': '60',
      'Access-Control-Allow-Origin': '*',
    });
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(await response.json()).toMatchObject({
      error: 'Slow down',
      message: 'Slow down',
      code: 'RATE_LIMITED',
      hint: expect.any(String),
    });
  });
});
