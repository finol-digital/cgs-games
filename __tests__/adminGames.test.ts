/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { adminDb, adminGetAllGames, adminGetGames, adminGetGamesFor } from '@/lib/firebase/admin';

jest.mock('firebase-admin/app', () => ({ getApps: () => [{}] }));
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({}) }));
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: jest.fn() }) }));

type GameDoc = ReturnType<typeof gameDoc>;

/** A stored game document; legacy listings omit visibility entirely. */
function gameDoc(id: string, visibility?: string, username = 'creator') {
  const data: Record<string, unknown> = {
    username,
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
 * Serves `docs`, newest first, like Firestore: an equality filter never matches a missing field.
 * Each read is recorded as its filters, ordering and limit, and the documents it returned.
 */
function mockGames(docs: GameDoc[]) {
  const reads: { filters: unknown[][]; orderBy: unknown[]; limit: number; read: string[] }[] = [];
  const query = (filters: unknown[][], orderBy: unknown[] = [], limit = Infinity) => ({
    where: (field: string, op: string, value: unknown) =>
      query([...filters, [field, op, value]], orderBy, limit),
    orderBy: (...order: unknown[]) => query(filters, order, limit),
    limit: (count: number) => query(filters, orderBy, count),
    get: async () => {
      const matches = docs
        .filter((doc) => filters.every(([field, , value]) => doc.data()[field as string] === value))
        .slice(0, limit);
      reads.push({ filters, orderBy, limit, read: matches.map((doc) => doc.id) });
      return { docs: matches };
    },
  });
  (adminDb.collection as jest.Mock).mockReturnValue(query([]));
  return reads;
}

describe('game listings', () => {
  beforeEach(() => jest.resetAllMocks());

  it('reads only the newest public games for the catalog', async () => {
    const reads = mockGames([
      gameDoc('hidden', 'private'),
      gameDoc('newest', 'public'),
      gameDoc('older', 'public'),
    ]);
    const games = await adminGetAllGames();
    expect(games.map((game) => [game.id, game.visibility])).toEqual([
      ['newest', 'public'],
      ['older', 'public'],
    ]);
    expect(reads).toEqual([
      {
        filters: [['visibility', '==', 'public']],
        orderBy: ['uploadedAt', 'desc'],
        limit: 100,
        read: ['newest', 'older'],
      },
    ]);
  });

  it('reads exactly as many public games as the home page shows', async () => {
    const reads = mockGames([
      gameDoc('first', 'private'),
      gameDoc('second', 'public'),
      gameDoc('third', 'private'),
      gameDoc('fourth', 'public'),
      gameDoc('fifth', 'public'),
    ]);
    expect((await adminGetGames(2)).map((game) => game.id)).toEqual(['second', 'fourth']);
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ limit: 2, read: ['second', 'fourth'] });
  });

  it("lists only a creator's public games unless they are requested", async () => {
    const reads = mockGames([
      gameDoc('hidden', 'private'),
      gameDoc('listed', 'public'),
      gameDoc('legacy'),
    ]);
    expect((await adminGetGamesFor('creator')).map((game) => game.id)).toEqual(['listed']);
    expect(reads[0].filters).toEqual([
      ['username', '==', 'creator'],
      ['visibility', '==', 'public'],
    ]);

    const all = await adminGetGamesFor('creator', { includePrivate: true });
    expect(all.map((game) => [game.id, game.visibility])).toEqual([
      ['hidden', 'private'],
      ['listed', 'public'],
      // A listing that missed the backfill still reads as public, as it always has.
      ['legacy', 'public'],
    ]);
    expect(reads[1].filters).toEqual([['username', '==', 'creator']]);
  });

  it('has a composite index for every public catalog query', () => {
    const { indexes } = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as {
      indexes: { collectionGroup: string; fields: { fieldPath: string; order: string }[] }[];
    };
    const games = indexes
      .filter((index) => index.collectionGroup === 'games')
      .map((index) => index.fields.map(({ fieldPath, order }) => `${fieldPath} ${order}`));
    expect(games).toContainEqual(['visibility ASCENDING', 'uploadedAt DESCENDING']);
    expect(games).toContainEqual([
      'username ASCENDING',
      'visibility ASCENDING',
      'uploadedAt DESCENDING',
    ]);
  });
});
