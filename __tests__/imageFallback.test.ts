import { directImageFallback, proxyImagePath } from '@/lib/imageFallback';

/** A proxy failure response that, like the real proxy, names the upstream URL it checked. */
function proxyResponse(path: string, code: string, status = 502, checked?: string) {
  const upstream = checked ?? 'https://' + path.slice('/api/proxy/'.length);
  return {
    ok: false,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-proxy-upstream-url' ? upstream : null),
    },
    body: { cancel: async () => {} },
    json: async () => ({ code }),
  } as unknown as Response;
}

describe('proxyImagePath', () => {
  it.each([
    ['https://example.com/banner.png', '/api/proxy/example.com/banner.png'],
    [' HTTPS://Example.com/a%2Fb.png?alt=media#top ', '/api/proxy/example.com/a%2Fb.png?alt=media'],
    // Dot segments resolve within the named host, so the browser can't re-target the proxy path.
    [
      'https://private.example/../public.example/x.png',
      '/api/proxy/private.example/public.example/x.png',
    ],
    [
      'https://private.example/%2e%2e/public.example/x.png',
      '/api/proxy/private.example/public.example/x.png',
    ],
    [
      'https://private.example\\..\\public.example/x.png',
      '/api/proxy/private.example/public.example/x.png',
    ],
  ])('builds the proxy path for %s from the normalized URL', (url, path) => {
    expect(proxyImagePath(url)).toBe(path);
    // The browser requests exactly this path, naming the same host as the direct URL.
    expect(new URL(path, 'https://cgs.games').pathname).toBe(path.split('?')[0]);
  });

  it.each(['/CardBack.png', 'http://example.com/a.png', 'not a url', ''])(
    'returns null for non-HTTPS sources: %s',
    (url) => expect(proxyImagePath(url)).toBeNull(),
  );
});

describe('directImageFallback', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  /** Makes the proxy report a failure with the given code. */
  function proxyFails(code: string, status = 502) {
    global.fetch = jest.fn(async (path: Parameters<typeof fetch>[0]) =>
      proxyResponse(String(path), code, status),
    );
  }

  it('checks and returns the same normalized URL', async () => {
    proxyFails('UNSUPPORTED_UPSTREAM_TYPE');
    await expect(
      directImageFallback('https://private.example/../public.example/x.png#frag'),
    ).resolves.toBe('https://private.example/public.example/x.png');
    expect(global.fetch).toHaveBeenCalledWith('/api/proxy/private.example/public.example/x.png', {
      cache: 'no-store',
    });
  });

  it.each(['UNSUPPORTED_UPSTREAM_TYPE', 'UPSTREAM_ERROR'])('allows %s', async (code) => {
    proxyFails(code);
    await expect(directImageFallback('https://example.com/a.png')).resolves.toBe(
      'https://example.com/a.png',
    );
  });

  it.each([
    ['INVALID_REQUEST', 400],
    ['RATE_LIMITED', 429],
    ['UPSTREAM_UNREACHABLE', 502],
  ])('refuses %s', async (code, status) => {
    proxyFails(code, status);
    await expect(directImageFallback('https://example.com/a.png')).resolves.toBeNull();
  });

  it('refuses when the proxy now succeeds or the check fails', async () => {
    const cancel = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: { cancel } });
    await expect(directImageFallback('https://example.com/a.png')).resolves.toBeNull();
    expect(cancel).toHaveBeenCalled();
    global.fetch = jest.fn().mockRejectedValue(new TypeError('offline'));
    await expect(directImageFallback('https://example.com/a.png')).resolves.toBeNull();
  });

  it.each([
    ['a missing checked URL', null],
    ['a different checked URL', 'https://public.example/a.png'],
    ['a normalized variant', 'https://example.com/a.png?'],
  ])('refuses when the proxy reports %s', async (_case, checked) => {
    const response = proxyResponse('/api/proxy/example.com/a.png', 'UNSUPPORTED_UPSTREAM_TYPE');
    jest.spyOn(response.headers, 'get').mockReturnValue(checked);
    global.fetch = jest.fn().mockResolvedValue(response);
    await expect(directImageFallback('https://example.com/a.png')).resolves.toBeNull();
  });

  it('refuses a trailing-slash path, which the proxy checks without the slash', async () => {
    global.fetch = jest.fn(async () =>
      proxyResponse(
        '/api/proxy/example.com/images/',
        'UNSUPPORTED_UPSTREAM_TYPE',
        502,
        'https://example.com/images',
      ),
    );
    await expect(directImageFallback('https://example.com/images/')).resolves.toBeNull();
  });

  it.each(['https://example.com', 'https://example.com/?image=1'])(
    'allows a root-path image the proxy checked exactly: %s',
    async (url) => {
      const checked = new URL(url).href;
      global.fetch = jest.fn(async () =>
        proxyResponse('/api/proxy/example.com', 'UNSUPPORTED_UPSTREAM_TYPE', 502, checked),
      );
      await expect(directImageFallback(url)).resolves.toBe(checked);
    },
  );

  it('never asks the proxy about URLs the proxy would refuse', async () => {
    global.fetch = jest.fn();
    await expect(directImageFallback('https://192.168.1.1/a.png')).resolves.toBeNull();
    await expect(directImageFallback('http://example.com/a.png')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
