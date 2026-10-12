/** @jest-environment node */
import { POST as publish } from '@/app/api/games/route';
import { POST as upload } from '@/app/api/games/upload/route';
import { DELETE as remove } from '@/app/api/games/[id]/route';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { fetchGameSpecification } from '@/lib/fetchGameSpecification';
import JSZip from 'jszip';

jest.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifyIdToken: jest.fn() },
  adminDb: { collection: jest.fn() },
  adminStorage: { bucket: jest.fn() },
}));
jest.mock('@/lib/fetchGameSpecification', () => ({
  fetchGameSpecification: jest.fn(),
  UnsafeGameUrlError: class extends Error {},
}));
const erase = jest.fn();
const add = jest.fn();
const fileDelete = jest.fn();
const listFiles = jest.fn();
let profile: Record<string, unknown>;
let registration: Record<string, unknown>;
let game: Record<string, unknown>;
let logs: jest.SpyInstance[];
const request = (body?: unknown) =>
  new Request('https://cgs.games/api/games', {
    method: 'POST',
    headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const context = { params: Promise.resolve({ id: 'game-id' }) };
beforeEach(() => {
  jest.resetAllMocks();
  logs = [
    jest.spyOn(console, 'log').mockImplementation(() => {}),
    jest.spyOn(console, 'error').mockImplementation(() => {}),
  ];
  profile = { username: 'alice' };
  registration = { uid: 'alice-uid' };
  game = { username: 'alice', slug: 'original', storageBasePath: 'games/alice-uid/original' };
  jest.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: 'alice-uid' } as never);
  jest.mocked(adminDb.collection).mockImplementation(((name: string) => ({
    doc: () => ({
      get: async () => ({
        exists: true,
        data: () => (name === 'users' ? profile : name === 'usernames' ? registration : game),
      }),
      delete: erase,
    }),
    add,
  })) as never);
  listFiles.mockResolvedValue([[{ delete: fileDelete }]]);
  jest.mocked(adminStorage.bucket).mockReturnValue({ getFiles: listFiles } as never);
  jest.mocked(fetchGameSpecification).mockResolvedValue(Response.json({ name: 'New Game' }));
});
afterEach(() => logs.forEach((log) => log.mockRestore()));

describe('privileged Firebase write APIs', () => {
  it.each([publish, upload])(
    'rejects a forged profile before publishing or touching Storage',
    async (handler) => {
      registration = { uid: 'victim' };
      const response = await handler(
        request({
          autoUpdateUrl: 'https://example.test/cgs.json',
          stagedPath: 'staged-uploads/alice-uid/x.cgs.zip',
          originalFilename: 'game.cgs.zip',
        }),
      );
      expect(response.status).toBe(403);
      expect(add).not.toHaveBeenCalled();
      expect(adminStorage.bucket).not.toHaveBeenCalled();
      expect(fetchGameSpecification).not.toHaveBeenCalled();
    },
  );
  it.each([publish, upload])(
    'rejects revoked tokens before any database access',
    async (handler) => {
      jest.mocked(adminAuth.verifyIdToken).mockRejectedValue(new Error('revoked'));
      expect(
        (await handler(request({ autoUpdateUrl: 'https://example.test/cgs.json' }))).status,
      ).toBe(401);
      expect(adminAuth.verifyIdToken).toHaveBeenCalledWith('fixture-token', true);
      expect(adminDb.collection).not.toHaveBeenCalled();
    },
  );
  it('binds new listings to the verified UID, ignoring ownership input', async () => {
    expect(
      (
        await publish(
          request({
            autoUpdateUrl: 'https://example.test/cgs.json',
            ownerUid: 'victim',
            username: 'victim',
          }),
        )
      ).status,
    ).toBe(200);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUid: 'alice-uid', username: 'alice' }),
    );
  });
  it.each([
    'games/victim/original',
    'games/alice-uid',
    'games/alice-uid/another',
    'games/alice-uid/original/..',
    'games',
    '',
  ])('refuses an unowned or ambiguous deletion prefix %s', async (prefix) => {
    game.storageBasePath = prefix;
    if (!prefix) game.slug = '';
    const result = await remove(request(), context);
    // A missing/empty path has no Storage assets to delete; every nonempty invalid path fails closed.
    expect(result.status).toBe(prefix ? 403 : 200);
    expect(listFiles).not.toHaveBeenCalled();
    if (prefix) expect(erase).not.toHaveBeenCalled();
  });
  it.each([
    { username: 'bob' },
    { ownerUid: 'bob-uid' },
    { ownerUid: null },
    { slug: '../victim' },
  ])('rejects mismatched game ownership %j', async (change) => {
    game = { ...game, ...change };
    expect((await remove(request(), context)).status).toBe(403);
    expect(erase).not.toHaveBeenCalled();
    expect(listFiles).not.toHaveBeenCalled();
  });
  it('does not accept a forged profile as evidence of deletion ownership', async () => {
    registration = { uid: 'victim' };
    expect((await remove(request(), context)).status).toBe(403);
    expect(erase).not.toHaveBeenCalled();
  });
  it.each([undefined, 'alice-uid'])(
    'deletes only the verified creator prefix for legacy/new listings (%s)',
    async (ownerUid) => {
      if (ownerUid) game.ownerUid = ownerUid;
      expect((await remove(request(), context)).status).toBe(200);
      expect(listFiles).toHaveBeenCalledWith({ prefix: 'games/alice-uid/original/' });
      expect(fileDelete).toHaveBeenCalledTimes(1);
      expect(erase).toHaveBeenCalledTimes(1);
      expect(adminAuth.verifyIdToken).toHaveBeenCalledWith('fixture-token', true);
    },
  );
  it('rejects revocation and nested document IDs before deletion', async () => {
    expect(
      (await remove(request(), { params: Promise.resolve({ id: 'nested/other/id' }) })).status,
    ).toBe(400);
    expect(adminDb.collection).not.toHaveBeenCalled();
    jest.mocked(adminAuth.verifyIdToken).mockRejectedValue(new Error('revoked'));
    expect((await remove(request(), context)).status).toBe(401);
    expect(erase).not.toHaveBeenCalled();
  });
  it('rejects another user staging path without downloading or deleting it', async () => {
    expect(
      (
        await upload(
          request({
            stagedPath: 'staged-uploads/victim/x.cgs.zip',
            originalFilename: 'game.cgs.zip',
          }),
        )
      ).status,
    ).toBe(400);
    expect(adminStorage.bucket).not.toHaveBeenCalled();
  });

  it('publishes an owned staged archive only beneath the verified UID and records its owner', async () => {
    const zip = new JSZip();
    zip.file('cgs.json', JSON.stringify({ name: 'My Game' }));
    zip.file('Banner.png', new Uint8Array([1, 2, 3]));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const save = jest.fn().mockResolvedValue(undefined);
    const stagedDelete = jest.fn().mockResolvedValue(undefined);
    const file = jest.fn((path: string) =>
      path.startsWith('staged-uploads/')
        ? {
            getMetadata: async () => [{ size: buffer.length }],
            download: async () => [buffer],
            delete: stagedDelete,
          }
        : { save },
    );
    jest.mocked(adminStorage.bucket).mockReturnValue({ name: 'fixture-bucket', file } as never);
    const query = { where: jest.fn(), get: async () => ({ empty: true }) };
    query.where.mockReturnValue(query);
    const original = jest.mocked(adminDb.collection).getMockImplementation()!;
    jest
      .mocked(adminDb.collection)
      .mockImplementation(((name: string) => ({ ...original(name), where: query.where })) as never);
    const response = await upload(
      request({
        stagedPath: 'staged-uploads/alice-uid/x.cgs.zip',
        originalFilename: 'game.cgs.zip',
        ownerUid: 'victim',
        username: 'victim',
      }),
    );
    expect(response.status).toBe(200);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUid: 'alice-uid',
        username: 'alice',
        storageBasePath: 'games/alice-uid/my_game',
      }),
    );
    expect(file.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        'staged-uploads/alice-uid/x.cgs.zip',
        'games/alice-uid/my_game/Banner.png',
        'games/alice-uid/my_game/cgs.json',
      ]),
    );
    expect(
      file.mock.calls.every(
        ([path]) =>
          path.startsWith('games/alice-uid/') || path === 'staged-uploads/alice-uid/x.cgs.zip',
      ),
    ).toBe(true);
    expect(stagedDelete).toHaveBeenCalledTimes(1);
  });
});
