/** @jest-environment node */
import { adminDb, adminGetAllGames, adminGetGames, adminGetGamesFor } from '@/lib/firebase/admin';

jest.mock('firebase-admin/app', () => ({ getApps: () => [{}] }));
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({}) }));
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: jest.fn() }) }));

/** A stored game document; legacy listings omit visibility entirely. */
function gameDoc(id: string, visibility?: string) {
  const data: Record<string, unknown> = {
    username: 'creator',
    slug: id,
    name: id,
    bannerImageUrl: '',
    autoUpdateUrl: '',
    copyright: '',
    uploadedAt: { toDate: () => new Date('2026-10-01T00:00:00.000Z') },
  };
  if (visibility) data.visibility = visibility;
  return { id, data: () => data };
}

/**
 * Serves `docs`, newest first, through the orderBy/limit/startAfter chain, recording each page
 * read as [limit, cursor id] so tests can check how far past private games the listing paged.
 */
function mockGames(docs: ReturnType<typeof gameDoc>[]) {
  const pages: [number, string | null][] = [];
  const where = jest.fn();
  const page = (count: number, after: ReturnType<typeof gameDoc> | null) => ({
    startAfter: (cursor: ReturnType<typeof gameDoc>) => page(count, cursor),
    get: async () => {
      pages.push([count, after?.id ?? null]);
      const start = after ? docs.indexOf(after) + 1 : 0;
      return { docs: docs.slice(start, start + count) };
    },
  });
  const games = { orderBy: () => ({ limit: (count: number) => page(count, null) }), where };
  where.mockReturnValue(games);
  (adminDb.collection as jest.Mock).mockReturnValue(games);
  return { pages, where };
}

describe('game listings', () => {
  beforeEach(() => jest.resetAllMocks());

  it('treats legacy listings without a visibility field as public', async () => {
    mockGames([gameDoc('legacy'), gameDoc('listed', 'public')]);
    const games = await adminGetAllGames();
    expect(games.map((game) => [game.id, game.visibility])).toEqual([
      ['legacy', 'public'],
      ['listed', 'public'],
    ]);
  });

  it('pages past private games to fill the requested count with public ones', async () => {
    const { pages } = mockGames([
      gameDoc('first', 'private'),
      gameDoc('second'),
      gameDoc('third', 'private'),
      gameDoc('fourth', 'private'),
      gameDoc('fifth', 'public'),
      gameDoc('sixth'),
    ]);
    expect((await adminGetGames(2)).map((game) => game.id)).toEqual(['second', 'fifth']);
    expect(pages).toEqual([
      [2, null],
      [2, 'second'],
      [2, 'fourth'],
    ]);
  });

  it('stops at the end of the collection when too few games are public', async () => {
    const { pages } = mockGames([gameDoc('only'), gameDoc('hidden', 'private')]);
    expect((await adminGetGames(2)).map((game) => game.id)).toEqual(['only']);
    expect(pages).toEqual([
      [2, null],
      [2, 'hidden'],
    ]);
  });

  it("hides a creator's private games unless they are requested", async () => {
    const { where } = mockGames([gameDoc('hidden', 'private'), gameDoc('listed')]);
    expect((await adminGetGamesFor('creator')).map((game) => game.id)).toEqual(['listed']);
    expect(where).toHaveBeenCalledWith('username', '==', 'creator');
    const all = await adminGetGamesFor('creator', { includePrivate: true });
    expect(all.map((game) => [game.id, game.visibility])).toEqual([
      ['hidden', 'private'],
      ['listed', 'public'],
    ]);
  });
});
