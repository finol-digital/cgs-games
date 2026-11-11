/** @jest-environment node */
import {
  backfillGameVisibility,
  backfilledVisibility,
  countGamesWithoutVisibility,
} from '@/scripts/lib/gameVisibility.mjs';

/** Selects the stored games a count query matches. */
type GameFilter = Parameters<StoredGame[]['filter']>[0];

interface StoredGame {
  id: string;
  data: Record<string, unknown>;
  updateTime: number;
}

/** A games collection supporting just the reads and writes the backfill makes. */
function fakeDb(games: StoredGame[], afterScan = () => {}) {
  const pages: number[] = [];
  const snapshot = (game: StoredGame) => {
    const data = { ...game.data };
    return { id: game.id, ref: game, updateTime: game.updateTime, data: () => data };
  };
  const scan = (limit: number, after?: string) => ({
    startAfter: (cursor: { id: string }) => scan(limit, cursor.id),
    get: async () => {
      const sorted = [...games].sort((a, b) => a.id.localeCompare(b.id));
      const docs = sorted.filter((game) => after === undefined || game.id > after).slice(0, limit);
      pages.push(docs.length);
      const result = { docs: docs.map(snapshot) };
      afterScan();
      return result;
    },
  });
  const count = (matches: GameFilter) => ({
    count: () => ({
      get: async () => ({ data: () => ({ count: games.filter(matches).length }) }),
    }),
  });
  const writes: Promise<void>[] = [];
  const db = {
    collection: () => ({
      orderBy: () => ({ select: () => ({ limit: (limit: number) => scan(limit) }) }),
      count: () => count(() => true).count(),
      where: (field: string, op: string, values: unknown[]) =>
        count((game) => values.includes(game.data[field])),
    }),
    bulkWriter: () => ({
      update: (
        game: StoredGame,
        data: Record<string, unknown>,
        { lastUpdateTime }: { lastUpdateTime: number },
      ) => {
        const write = (async () => {
          if (game.updateTime !== lastUpdateTime)
            throw Object.assign(new Error('stale'), { code: 9 });
          Object.assign(game.data, data);
          game.updateTime++;
        })();
        writes.push(write.catch(() => {}));
        return write;
      },
      close: () => Promise.all(writes),
    }),
  };
  return { db, pages };
}

const game = (id: string, visibility?: unknown): StoredGame => ({
  id,
  data: visibility === undefined ? { name: id } : { name: id, visibility },
  updateTime: 1,
});

describe('game visibility backfill', () => {
  it.each([
    [undefined, 'public'],
    [null, 'public'],
    ['hidden', 'public'],
    ['public', null],
    ['private', null],
  ])('backfills a stored visibility of %j as %j', (visibility, expected) => {
    expect(backfilledVisibility({ visibility })).toBe(expected);
  });

  it('only reports what it would change in a dry run', async () => {
    const games = [game('a'), game('b', 'private'), game('c', null), game('d', 'public')];
    const { db } = fakeDb(games);
    expect(await backfillGameVisibility(db, { pageSize: 2 })).toEqual({
      mode: 'dry-run',
      scanned: 4,
      missingVisibility: 1,
      invalidVisibility: 1,
      updated: 0,
      failed: [],
    });
    expect(games.map(({ data }) => data.visibility)).toEqual([
      undefined,
      'private',
      null,
      'public',
    ]);
    expect(await countGamesWithoutVisibility(db)).toBe(2);
  });

  it('makes legacy games public across pages and is safe to rerun', async () => {
    const games = [game('a'), game('b', 'private'), game('c'), game('d'), game('e', 'public')];
    const { db, pages } = fakeDb(games);
    const summary = await backfillGameVisibility(db, { write: true, pageSize: 2 });
    expect(summary).toMatchObject({ mode: 'write', scanned: 5, updated: 3, failed: [] });
    expect(pages).toEqual([2, 2, 1]);
    expect(games.map(({ data }) => data.visibility)).toEqual([
      'public',
      'private',
      'public',
      'public',
      'public',
    ]);
    expect(await countGamesWithoutVisibility(db)).toBe(0);

    const rerun = await backfillGameVisibility(db, { write: true });
    expect(rerun).toMatchObject({ missingVisibility: 0, updated: 0, failed: [] });
  });

  it('never overwrites a game changed after it was read', async () => {
    const changed = game('a');
    // The owner makes the game private between the scan and the write.
    const { db } = fakeDb([changed, game('b')], () =>
      Object.assign(changed, { data: { visibility: 'private' }, updateTime: 2 }),
    );
    const summary = await backfillGameVisibility(db, { write: true });
    expect(summary).toMatchObject({ updated: 1, failed: [{ gameId: 'a', code: 9 }] });
    expect(changed.data.visibility).toBe('private');
  });
});
