import { getAllGames, getGame, getGames, getGamesFor, userDoc } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { collection, doc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

jest.mock('@/lib/firebase/firebase', () => ({
  db: { name: 'mockDb' },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

const collectionMock = collection as jest.Mock;
const docMock = doc as jest.Mock;
const getDocsMock = getDocs as jest.Mock;
const limitMock = limit as jest.Mock;
const orderByMock = orderBy as jest.Mock;
const queryMock = query as jest.Mock;
const whereMock = where as jest.Mock;

const createDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  get: (key: string) => data[key],
});

describe('firestore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collectionMock.mockImplementation((dbValue, name) => ({
      type: 'collection',
      dbValue,
      name,
    }));
    docMock.mockImplementation((dbValue, collectionName, id) => ({
      type: 'doc',
      dbValue,
      collectionName,
      id,
    }));
    getDocsMock.mockResolvedValue({ docs: [] });
    limitMock.mockImplementation((count) => ({ type: 'limit', count }));
    orderByMock.mockImplementation((field, direction) => ({
      type: 'orderBy',
      field,
      direction,
    }));
    queryMock.mockImplementation((...args) => ({ type: 'query', args }));
    whereMock.mockImplementation((field, op, value) => ({
      type: 'where',
      field,
      op,
      value,
    }));
  });

  it('maps documents in getAllGames', async () => {
    const uploadedAt = new Date('2024-02-03T00:00:00Z');
    const docs = [
      createDoc('game-1', {
        username: 'alice',
        slug: 'space-quest',
        name: 'Space Quest',
        bannerImageUrl: 'https://example.com/banner.png',
        autoUpdateUrl: 'https://example.com/auto.cgs.json',
        copyright: 'Alice',
        uploadedAt: { toDate: () => uploadedAt },
      }),
      createDoc('game-2', {
        username: 'bob',
        slug: 'ocean-odyssey',
        name: 'Ocean Odyssey',
        bannerImageUrl: 'https://example.com/banner2.png',
        autoUpdateUrl: 'https://example.com/auto2.cgs.json',
        copyright: 'Bob',
        uploadedAt: { toDate: () => uploadedAt },
      }),
    ];

    getDocsMock.mockResolvedValueOnce({ docs });

    const results = await getAllGames();

    expect(results).toEqual([
      {
        id: 'game-1',
        username: 'alice',
        slug: 'space-quest',
        name: 'Space Quest',
        bannerImageUrl: 'https://example.com/banner.png',
        autoUpdateUrl: 'https://example.com/auto.cgs.json',
        copyright: 'Alice',
        uploadedAt,
      },
      {
        id: 'game-2',
        username: 'bob',
        slug: 'ocean-odyssey',
        name: 'Ocean Odyssey',
        bannerImageUrl: 'https://example.com/banner2.png',
        autoUpdateUrl: 'https://example.com/auto2.cgs.json',
        copyright: 'Bob',
        uploadedAt,
      },
    ]);

    expect(collectionMock).toHaveBeenCalledWith(db, 'games');
    expect(orderByMock).toHaveBeenCalledWith('uploadedAt', 'desc');
    expect(limitMock).toHaveBeenCalledWith(100);

    const gamesQuery = queryMock.mock.results[0].value;
    const orderByConstraint = orderByMock.mock.results[0].value;
    const limitConstraint = limitMock.mock.results[0].value;
    expect(queryMock).toHaveBeenNthCalledWith(2, gamesQuery, orderByConstraint, limitConstraint);
  });

  it('filters by username in getGamesFor', async () => {
    await getGamesFor('testuser');

    expect(whereMock).toHaveBeenCalledWith('username', '==', 'testuser');
    expect(limitMock).toHaveBeenCalledWith(100);
  });

  it('uses the provided limit in getGames', async () => {
    await getGames(12);

    expect(limitMock).toHaveBeenCalledWith(12);
  });

  it('returns the encoded slug match in getGame', async () => {
    const uploadedAt = new Date('2024-04-05T00:00:00Z');
    const docSnapshot = createDoc('game-encoded', {
      username: 'alice',
      slug: 'my%20game',
      name: 'My Game',
      bannerImageUrl: 'https://example.com/banner.png',
      autoUpdateUrl: 'https://example.com/auto.cgs.json',
      copyright: 'Alice',
      uploadedAt: { toDate: () => uploadedAt },
    });

    getDocsMock.mockResolvedValueOnce({ docs: [docSnapshot] });

    const result = await getGame('alice', 'my game');

    expect(result).toEqual({
      id: 'game-encoded',
      username: 'alice',
      slug: 'my%20game',
      name: 'My Game',
      bannerImageUrl: 'https://example.com/banner.png',
      autoUpdateUrl: 'https://example.com/auto.cgs.json',
      copyright: 'Alice',
      uploadedAt,
    });
    expect(whereMock).toHaveBeenCalledWith('slug', '==', 'my%20game');
    expect(orderByMock).toHaveBeenCalledWith('uploadedAt', 'desc');
    expect(limitMock).toHaveBeenCalledWith(1);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to raw slug when encoded query misses', async () => {
    const uploadedAt = new Date('2024-04-06T00:00:00Z');
    const docSnapshot = createDoc('game-raw', {
      username: 'alice',
      slug: 'my game',
      name: 'My Game Raw',
      bannerImageUrl: 'https://example.com/banner.png',
      autoUpdateUrl: 'https://example.com/auto.cgs.json',
      copyright: 'Alice',
      uploadedAt: { toDate: () => uploadedAt },
    });

    getDocsMock.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [docSnapshot] });

    const result = await getGame('alice', 'my game');

    expect(result).toEqual({
      id: 'game-raw',
      username: 'alice',
      slug: 'my game',
      name: 'My Game Raw',
      bannerImageUrl: 'https://example.com/banner.png',
      autoUpdateUrl: 'https://example.com/auto.cgs.json',
      copyright: 'Alice',
      uploadedAt,
    });
    expect(whereMock).toHaveBeenCalledWith('slug', '==', 'my%20game');
    expect(whereMock).toHaveBeenCalledWith('slug', '==', 'my game');
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('returns undefined when no encoded match and no raw fallback', async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [] });

    const result = await getGame('alice', 'plain-slug');

    expect(result).toBeUndefined();
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('logs and rethrows errors from encoded slug query', async () => {
    const error = new Error('boom');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    getDocsMock.mockRejectedValueOnce(error);

    await expect(getGame('alice', 'my game')).rejects.toThrow('boom');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('encoded slug "my%20game"'),
      error,
    );

    consoleSpy.mockRestore();
  });

  it('returns a user doc reference', () => {
    const result = userDoc('user-123');

    expect(docMock).toHaveBeenCalledWith(db, 'users', 'user-123');
    expect(result).toEqual({
      type: 'doc',
      dbValue: db,
      collectionName: 'users',
      id: 'user-123',
    });
  });
});
