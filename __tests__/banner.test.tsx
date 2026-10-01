import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
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
