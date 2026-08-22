export const DEFAULT_CARD_BACK_PATH = '/CardBack.png';

interface BannerFallbackInput {
  bannerImageUrl?: string | null;
  cardBackImageUrl?: string | null;
}

export function resolveBannerImageUrl({
  bannerImageUrl,
  cardBackImageUrl,
}: BannerFallbackInput): string {
  return bannerImageUrl || cardBackImageUrl || DEFAULT_CARD_BACK_PATH;
}
