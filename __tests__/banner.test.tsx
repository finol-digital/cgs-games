import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Banner from '@/components/banner';

function imageSource() {
  const image = screen.getByRole('img', { name: 'Test game' });
  const optimizedUrl = new URL(image.getAttribute('src')!, 'https://cgs.games');
  return optimizedUrl.searchParams.get('url');
}

describe('Banner image sources', () => {
  it.each([
    'https://example.com/banner.png',
    'HTTPS://example.com/banner.png',
    'hTtPs://example.com/banner.png',
    ' \tHTTPS://example.com/banner.png\r\n',
    'https:/example.com/banner.png',
  ])('renders an optimized proxy image for an accepted HTTPS URL: %s', (img) => {
    // These variants are all accepted by the upload API's URL validation.
    expect(new URL(img).protocol).toBe('https:');
    render(<Banner img={img} txt="Test game" />);
    expect(imageSource()).toBe('/api/proxy/example.com/banner.png');
  });

  it('preserves Firebase encoded paths and media query parameters', () => {
    const path =
      'firebasestorage.googleapis.com/v0/b/cgs-games.appspot.com/o/games%2Ftest%2FBanner.png?alt=media&token=a%2Bb';
    render(<Banner img={` HTTPS://${path} `} txt="Test game" />);
    expect(imageSource()).toBe(`/api/proxy/${path}`);
  });

  it('keeps local public images outside the proxy', () => {
    render(<Banner img="/CardBack.png" txt="Test game" />);
    expect(imageSource()).toBe('/CardBack.png');
  });

  it.each([undefined, '', '  '])('uses the default banner for an empty source: %s', (img) => {
    render(<Banner img={img} txt="Test game" />);
    expect(imageSource()).toBe('/Card-Game-Simulator.png');
  });
});

describe('Banner proxy fallback', () => {
  const originalFetch = global.fetch;
  const image = () => screen.getByRole('img', { name: 'Test game' });

  /** Makes the proxy report a failure with the given code. */
  function proxyFails(code: string, status = 502) {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status, json: async () => ({ code }) });
  }

  beforeEach(() => proxyFails('UNSUPPORTED_UPSTREAM_TYPE'));
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads the original URL directly when the proxy reports a blocked upstream', async () => {
    render(<Banner img="https://example.com/banner%2010.png" txt="Test game" />);
    fireEvent.error(image());
    await waitFor(() =>
      expect(image()).toHaveAttribute('src', 'https://example.com/banner%2010.png'),
    );
    expect(image()).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(global.fetch).toHaveBeenCalledWith('/api/proxy/example.com/banner%2010.png', {
      cache: 'no-store',
    });
  });

  it.each([
    ['an unsafe destination or redirect', 'BAD_REQUEST', 400],
    ['our own rate limit', 'RATE_LIMITED', 429],
    ['an unreachable upstream', 'BAD_GATEWAY', 502],
  ])('stays on the proxy for %s', async (_reason, code, status) => {
    proxyFails(code, status);
    render(<Banner img="https://example.com/banner.png" txt="Test game" />);
    fireEvent.error(image());
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await act(async () => {});
    expect(imageSource()).toBe('/api/proxy/example.com/banner.png');
  });

  it('stays on the proxy when the proxy check itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('offline'));
    render(<Banner img="https://example.com/banner.png" txt="Test game" />);
    fireEvent.error(image());
    await act(async () => {});
    expect(imageSource()).toBe('/api/proxy/example.com/banner.png');
  });

  it('does not retry once the direct URL also fails', async () => {
    render(<Banner img="https://example.com/banner.png" txt="Test game" />);
    fireEvent.error(image());
    await waitFor(() => expect(image()).toHaveAttribute('src', 'https://example.com/banner.png'));
    fireEvent.error(image());
    await act(async () => {});
    expect(image()).toHaveAttribute('src', 'https://example.com/banner.png');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns to the proxy when the banner source changes', async () => {
    const { rerender } = render(<Banner img="https://example.com/a.png" txt="Test game" />);
    fireEvent.error(image());
    await waitFor(() => expect(image()).toHaveAttribute('src', 'https://example.com/a.png'));
    rerender(<Banner img="https://example.com/b.png" txt="Test game" />);
    expect(imageSource()).toBe('/api/proxy/example.com/b.png');
    rerender(<Banner img="https://example.com/a.png" txt="Test game" />);
    expect(imageSource()).toBe('/api/proxy/example.com/a.png');
  });

  it('ignores a check that finishes after the source changed', async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>();
    global.fetch = jest.fn().mockReturnValue(promise);
    const { rerender } = render(<Banner img="https://example.com/a.png" txt="Test game" />);
    fireEvent.error(image());
    rerender(<Banner img="https://example.com/b.png" txt="Test game" />);
    await act(async () =>
      resolve({ ok: false, json: async () => ({ code: 'UNSUPPORTED_UPSTREAM_TYPE' }) }),
    );
    expect(imageSource()).toBe('/api/proxy/example.com/b.png');
  });

  it('ignores a check that finishes after leaving and returning to the same URL', async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>();
    global.fetch = jest.fn().mockReturnValue(promise);
    const { rerender } = render(<Banner img="https://example.com/a.png" txt="Test game" />);
    fireEvent.error(image());
    rerender(<Banner img="https://example.com/b.png" txt="Test game" />);
    rerender(<Banner img="https://example.com/a.png" txt="Test game" />);
    await act(async () =>
      resolve({ ok: false, json: async () => ({ code: 'UNSUPPORTED_UPSTREAM_TYPE' }) }),
    );
    expect(imageSource()).toBe('/api/proxy/example.com/a.png');
  });

  it('keeps the current fallback when an earlier check finishes late', async () => {
    const blocked = { ok: false, json: async () => ({ code: 'UNSUPPORTED_UPSTREAM_TYPE' }) };
    const { promise, resolve } = Promise.withResolvers<unknown>();
    global.fetch = jest.fn().mockReturnValueOnce(promise).mockResolvedValueOnce(blocked);
    const { rerender } = render(<Banner img="https://example.com/a.png" txt="Test game" />);
    fireEvent.error(image());
    rerender(<Banner img="https://example.com/b.png" txt="Test game" />);
    fireEvent.error(image());
    await waitFor(() => expect(image()).toHaveAttribute('src', 'https://example.com/b.png'));
    await act(async () => resolve(blocked));
    expect(image()).toHaveAttribute('src', 'https://example.com/b.png');
  });

  it.each(['https://192.168.1.1/banner.png', 'https://printer.local/banner.png'])(
    'never loads a private destination directly: %s',
    async (img) => {
      render(<Banner img={img} txt="Test game" />);
      fireEvent.error(image());
      await act(async () => {});
      expect(imageSource()).toBe('/api/proxy/' + img.slice('https://'.length));
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it('keeps local images on the optimizer after an error', () => {
    render(<Banner img="/CardBack.png" txt="Test game" />);
    fireEvent.error(image());
    expect(imageSource()).toBe('/CardBack.png');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
