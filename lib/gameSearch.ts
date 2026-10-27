import Game from '@/lib/game';

export interface SearchGame extends Pick<
  Game,
  'id' | 'name' | 'username' | 'slug' | 'copyright' | 'bannerImageUrl'
> {}

/** Keeps header suggestions and the full Browse results consistent. */
export function matchesGameSearch(
  game: Pick<Game, 'name' | 'username' | 'slug' | 'copyright'>,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  return [game.name, game.username, game.slug, game.copyright].some((value) =>
    (value || '').toLowerCase().includes(normalized),
  );
}

export function browseSearchHref(query: string): string {
  const normalized = query.trim();
  return normalized ? `/browse?${new URLSearchParams({ q: normalized })}` : '/browse';
}
