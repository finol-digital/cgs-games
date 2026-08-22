import { DEFAULT_CARD_BACK_PATH, resolveBannerImageUrl } from '@/lib/bannerFallback';

describe('resolveBannerImageUrl', () => {
  it('returns banner image when present', () => {
    expect(
      resolveBannerImageUrl({
        bannerImageUrl: 'https://example.com/banner.png',
        cardBackImageUrl: 'https://example.com/card-back.png',
      }),
    ).toBe('https://example.com/banner.png');
  });

  it('falls back to card back image when banner is missing', () => {
    expect(
      resolveBannerImageUrl({
        bannerImageUrl: '',
        cardBackImageUrl: 'https://example.com/card-back.png',
      }),
    ).toBe('https://example.com/card-back.png');
  });

  it('falls back to default CGS card back when both banner and card back are missing', () => {
    expect(
      resolveBannerImageUrl({
        bannerImageUrl: undefined,
        cardBackImageUrl: undefined,
      }),
    ).toBe(DEFAULT_CARD_BACK_PATH);
  });
});
