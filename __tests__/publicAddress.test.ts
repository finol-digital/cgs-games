import { canLoadImageDirectly } from '@/lib/publicAddress';

describe('canLoadImageDirectly', () => {
  it.each([
    'https://keyforging.com/wp-content/uploads/2022/06/1-SQUAREAsset%2010.png',
    ' HTTPS://Example.com/banner.png ',
    'https://example.com./banner.png',
    'https://8.8.8.8/banner.png',
    'https://[2001:4860:4860::8888]/banner.png',
  ])('allows public HTTPS images: %s', (url) => {
    expect(canLoadImageDirectly(url)).toBe(true);
  });

  it.each([
    'http://example.com/banner.png',
    'https://user:pass@example.com/banner.png',
    'https://example.com:8443/banner.png',
    'https://127.0.0.1/banner.png',
    'https://0x7f.1/banner.png',
    'https://10.0.0.1/banner.png',
    'https://192.168.1.1/banner.png',
    'https://169.254.169.254/banner.png',
    'https://[::1]/banner.png',
    'https://[fd00::1]/banner.png',
    'https://[::ffff:192.168.1.1]/banner.png',
    'https://localhost/banner.png',
    'https://app.localhost/banner.png',
    'https://printer.local/banner.png',
    'https://service.internal/banner.png',
    'https://router.home.arpa/banner.png',
    'https://intranet/banner.png',
    'not a url',
  ])('refuses URLs the proxy would refuse: %s', (url) => {
    expect(canLoadImageDirectly(url)).toBe(false);
  });
});
