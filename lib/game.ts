/** Private games are unlisted: they are omitted from catalogs but open to anyone with the link. */
export type GameVisibility = 'public' | 'private';

export function isGameVisibility(value: unknown): value is GameVisibility {
  return value === 'public' || value === 'private';
}

/** Reads an optional publish-request visibility: omitted means public, anything unknown is null. */
export function parseGameVisibility(value: unknown): GameVisibility | null {
  if (value === undefined || value === null) return 'public';
  return isGameVisibility(value) ? value : null;
}

export default interface Game {
  id: string;
  username: string;
  slug: string;
  name: string;
  bannerImageUrl: string;
  autoUpdateUrl: string;
  copyright: string;
  uploadedAt: Date;
  visibility: GameVisibility;
  storageBasePath?: string;
}
