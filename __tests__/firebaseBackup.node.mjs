import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  configuration,
  pages,
  snapshotTime,
  copyObject,
  exportAuth,
  runBackup,
  checkBackup,
  verifyBackup,
  checkRestore,
  checkVolume,
  objectPeriod,
  OBJECT_PERIOD_DAYS,
} from '../scripts/backups/backup.mjs';

const config = configuration({
  SOURCE_PROJECT: 'production',
  BACKUP_PROJECT: 'backups',
  ARCHIVE_BUCKET: 'archive',
  EXPORT_BUCKET: 'staging',
  SOURCE_BUCKETS: 'assets',
});
const now = new Date('2026-10-13T02:00:00Z');

const assetFile = {
  name: 'games/a/file.json',
  generation: '123',
  size: '12',
  crc32c: 'test-checksum',
};

function fakeCloud({
  failStorage = false,
  failImport = false,
  assets = [assetFile],
  importedDocuments = '1480',
  restoredCount = '1',
} = {}) {
  const saved = new Map();
  // Archive objects created by server-side rewrites, as the list API would describe them.
  const copied = new Map();
  const actions = [];
  let exportPrefix;
  const api = async (address, options = {}) => {
    const url = new URL(address);
    const path = decodeURIComponent(url.pathname);
    if (path.endsWith('/fields')) {
      assert.equal(
        url.searchParams.get('filter'),
        'indexConfig.usesAncestorConfig:false OR ttlConfig:*',
      );
    }
    actions.push({ path, method: options.method || 'GET' });
    if (url.hostname === 'storage.googleapis.com' && path.startsWith('/upload/')) {
      const name = url.searchParams.get('name');
      assert.equal(url.searchParams.get('ifGenerationMatch'), '0');
      assert.ok(!saved.has(name), 'never overwrite an archive');
      saved.set(name, JSON.parse(options.body));
      return { generation: '1' };
    }
    if (path.includes('/rewriteTo/')) {
      if (failStorage && path.includes('/b/assets/')) throw new Error('source disappeared');
      assert.ok(['123', '456'].includes(url.searchParams.get('sourceGeneration')));
      assert.equal(url.searchParams.get('ifGenerationMatch'), '0');
      const destination = path.split('/rewriteTo/b/archive/o/')[1];
      if (destination) {
        assert.ok(!copied.has(destination), 'never overwrite an archived object');
        copied.set(destination, {
          name: destination,
          generation: '456',
          size: '12',
          crc32c: 'test-checksum',
          timeCreated: now.toISOString(),
        });
      }
      return { done: true, resource: { size: '12', crc32c: 'test-checksum', generation: '456' } };
    }
    if (path.endsWith('/b/staging/o'))
      return {
        items: [
          {
            name: `${exportPrefix}/${exportPrefix.split('/').at(-1)}.overall_export_metadata`,
            generation: '123',
            size: '12',
            crc32c: 'test-checksum',
          },
        ],
      };
    if (path.endsWith('/b/assets/o')) return { items: assets };
    if (path.endsWith('/b/archive/o'))
      return {
        items: [
          ...[...saved.keys()].map((name) => ({
            name,
            generation: '1',
            timeCreated: now.toISOString(),
          })),
          ...copied.values(),
        ].filter(({ name }) => name.startsWith(url.searchParams.get('prefix'))),
      };
    if (path.includes('/b/archive/o/')) return saved.get(path.split('/b/archive/o/')[1]);
    if (path.endsWith('/databases/(default)'))
      return {
        pointInTimeRecoveryEnablement: 'POINT_IN_TIME_RECOVERY_ENABLED',
        earliestVersionTime: '2026-10-12T00:00:00Z',
        locationId: 'nam5',
      };
    if (path === '/v1/projects/backups/databases' && options.method === 'POST')
      return { done: true };
    if (path.includes('/databases/drill-')) {
      if (path.endsWith(':importDocuments')) {
        const exportDirectory = options.body.inputUriPrefix.replace('gs://archive/', '');
        const basename = exportDirectory.split('/').at(-1);
        assert.ok(!basename.endsWith('.overall_export_metadata'), 'REST import takes a directory');
        const exportManifest = [...saved.entries()].find(([name]) =>
          name.endsWith('firestore-manifest.json'),
        )[1];
        assert.ok(
          exportManifest.some(
            ({ backup }) =>
              backup.name === `${exportDirectory}/${basename}.overall_export_metadata`,
          ),
        );
        return {
          done: true,
          metadata: { progressDocuments: { completedWork: importedDocuments } },
          ...(failImport ? { error: { code: 9 } } : {}),
        };
      }
      if (path.endsWith(':runAggregationQuery'))
        return [{ result: { aggregateFields: { total: { integerValue: restoredCount } } } }];
      if (options.method === 'DELETE')
        return { response: { '@type': 'type.googleapis.com/google.firestore.admin.v1.Database' } };
      return { etag: 'created-by-this-drill' };
    }
    if (path.endsWith(':exportDocuments')) {
      assert.equal(options.body.collectionIds, undefined, 'include every collection group');
      exportPrefix = options.body.outputUriPrefix.replace('gs://staging/', '');
      return {
        name: 'projects/production/databases/(default)/operations/1',
        done: true,
        metadata: { progressDocuments: { completedWork: '1480' } },
      };
    }
    if (path.endsWith('/config')) return { signIn: { hashConfig: { signerKey: 'sensitive-key' } } };
    if (path.endsWith('/accounts:batchGet'))
      return {
        users: [
          {
            localId: 'original-id',
            passwordHash: 'hash',
            salt: 'salt',
            mfaInfo: [{ phoneInfo: '+15555550000' }],
          },
        ],
      };
    return {};
  };
  return { api, saved, copied, actions };
}

const storageCopies = (actions) =>
  actions.filter(({ path }) => path.includes('/b/assets/o/') && path.includes('/rewriteTo/'));

describe('Firebase disaster recovery backups', () => {
  it('alerts on major account, database or file loss while ignoring small or unavailable baselines', () => {
    const before = {
      auth: { users: 100 },
      storage: [{ bytes: '10000000' }],
      firestore: { documentCount: '1000' },
    };
    assert.throws(() => checkVolume(before, { ...before, auth: { users: 60 } }), /volume dropped/);
    assert.throws(
      () => checkVolume(before, { ...before, storage: [{ bytes: '1000000' }] }),
      /volume dropped/,
    );
    assert.throws(
      () => checkVolume(before, { ...before, firestore: { documentCount: '100' } }),
      /volume dropped/,
    );
    assert.doesNotThrow(() => checkVolume(before, { ...before, auth: { users: 90 } }));
    assert.doesNotThrow(() =>
      checkVolume(
        { ...before, auth: { users: 2 }, firestore: {} },
        { ...before, auth: { users: 0 }, firestore: {} },
      ),
    );
  });
  it('rejects a shared production project and archive/source overlap', () => {
    const env = {
      SOURCE_PROJECT: 'same',
      BACKUP_PROJECT: 'same',
      ARCHIVE_BUCKET: 'a',
      EXPORT_BUCKET: 'e',
      SOURCE_BUCKETS: 's',
    };
    assert.throws(() => configuration(env), /separate project/);
    assert.throws(
      () => configuration({ ...env, BACKUP_PROJECT: 'different', SOURCE_BUCKETS: 'a' }),
      /distinct/,
    );
  });

  it('exports a valid whole-minute snapshot and refuses unavailable history', () => {
    assert.equal(snapshotTime(now, '2026-10-12T00:00:00Z'), '2026-10-13T01:58:00.000Z');
    assert.throws(() => snapshotTime(now, '2026-10-13T01:59:00Z'), /not ready/);
  });

  it('paginates Auth using its distinct nextPageToken request parameter', async () => {
    const batches = [];
    const api = async (address) =>
      new URL(address).searchParams.has('nextPageToken')
        ? { users: [2] }
        : { users: [1], nextPageToken: 'next' };
    for await (const batch of pages(api, 'https://example.test/accounts', 'users', 'nextPageToken'))
      batches.push(...batch);
    assert.deepEqual(batches, [1, 2]);
  });

  it('rejects repeating page tokens instead of completing a truncated backup', async () => {
    await assert.rejects(async () => {
      for await (const batch of pages(
        async () => ({ items: [1], nextPageToken: 'same' }),
        'https://example.test',
        'items',
      ))
        assert.ok(batch);
    }, /Repeated/);
  });

  it('pins source generations, finishes multipart rewrites and checks integrity', async () => {
    let calls = 0;
    await copyObject(
      async (address) => {
        const url = new URL(address);
        assert.equal(url.searchParams.get('sourceGeneration'), '123');
        assert.equal(url.searchParams.get('ifGenerationMatch'), '0');
        if (++calls === 1) return { done: false, rewriteToken: 'continue' };
        assert.equal(url.searchParams.get('rewriteToken'), 'continue');
        return { done: true, resource: { size: '12', crc32c: 'crc', generation: '456' } };
      },
      'source',
      { name: 'nested/a b', generation: '123', size: '12', crc32c: 'crc' },
      'archive',
      'run/a b',
    );
    assert.equal(calls, 2);
    await assert.rejects(
      () =>
        copyObject(
          async () => ({ done: true, resource: { size: '12', crc32c: 'wrong' } }),
          'source',
          { name: 'x', generation: '123', size: '12', crc32c: 'crc' },
          'archive',
          'x',
        ),
      /mismatch/,
    );
  });

  it('fails when password recovery configuration is missing', async () => {
    await assert.rejects(
      () =>
        exportAuth(
          async () => ({}),
          'source',
          async () => {},
        ),
      /hash configuration missing/,
    );
  });

  it('fails when tenants would otherwise be silently omitted', async () => {
    await assert.rejects(
      () =>
        exportAuth(
          async () => ({ multiTenant: { allowTenants: true } }),
          'source',
          async () => {},
        ),
      /Tenant backup/,
    );
  });

  it('does not publish a completion marker when any file fails', async () => {
    const { api, saved } = fakeCloud({ failStorage: true });
    await assert.rejects(() => runBackup(config, api, { now: () => now }), /source disappeared/);
    assert.ok(![...saved.keys()].some((key) => key.startsWith('completed/')));
  });

  it('preserves Auth identifiers and MFA and publishes a verifiable completion last', async () => {
    const { api, saved } = fakeCloud();
    const manifest = await runBackup(config, api, { now: () => now });
    const authPage = [...saved.entries()].find(([name]) => name.endsWith('users-000000.json'))[1];
    assert.equal(authPage.users[0].localId, 'original-id');
    assert.equal(authPage.users[0].mfaInfo.length, 1);
    assert.equal(manifest.storage[0].objects, 1);
    assert.equal(manifest.firestore.documentCount, '1480');
    assert.ok([...saved.keys()].at(-1).startsWith('completed/'));
    assert.equal((await checkBackup(config, api, now)).run, manifest.run);
    await assert.rejects(
      () => checkBackup(config, api, new Date('2026-10-15T00:00:00Z')),
      /recovery window/,
    );
    saved.get(`runs/${manifest.run}/manifest.json`).auth.users++;
    await assert.rejects(() => checkBackup(config, api, now), /checksum mismatch/);
  });

  it('alerts when there has never been a complete backup', async () => {
    await assert.rejects(() => checkBackup(config, async () => ({}), now), /No completed backup/);
  });

  it('restores to a new isolated database and only deletes that database after verification', async () => {
    const { api, saved, actions } = fakeCloud();
    await runBackup(config, api, { now: () => now });
    const report = await verifyBackup({ ...config, restoreBucket: 'restore-test' }, api, {
      now,
      pause: async () => assert.fail('Do not poll a terminal deletion response without done'),
    });
    assert.equal(report.filesRestored, 1);
    assert.equal(report.authRecordsValidated, 1);
    const deletions = actions.filter((action) => action.method === 'DELETE');
    assert.equal(deletions.length, 1);
    assert.match(deletions[0].path, /^\/v1\/projects\/backups\/databases\/drill-/);
    assert.ok([...saved.keys()].some((key) => key.startsWith('verified/')));
    await checkRestore(config, api, now);
  });

  it('preserves a failed restore for investigation and never records verification', async () => {
    const { api, saved, actions } = fakeCloud({ failImport: true });
    await runBackup(config, api, { now: () => now });
    await assert.rejects(
      () => verifyBackup({ ...config, restoreBucket: 'restore-test' }, api, { now }),
      /Restore operation failed/,
    );
    assert.equal(actions.filter((action) => action.method === 'DELETE').length, 0);
    assert.ok(![...saved.keys()].some((key) => key.startsWith('verified/')));
  });

  it('archives each file generation once per period and reuses it in later runs', async () => {
    const { api, saved, copied, actions } = fakeCloud();
    const first = await runBackup(config, api, { now: () => now });
    const name = `objects/p${objectPeriod(now)}/assets/123/games/a/file.json`;
    assert.ok(copied.has(name));
    assert.deepEqual(first.storage[0], {
      bucket: 'assets',
      objects: 1,
      bytes: '12',
      copied: 1,
      reused: 0,
      excludedPrefixes: ['staged-uploads/'],
    });

    const later = new Date(now.getTime() + 86400000);
    assert.equal(objectPeriod(later), objectPeriod(now), 'fixture stays within one period');
    const second = await runBackup(config, api, { now: () => later });
    assert.equal(storageCopies(actions).length, 1, 'the second run copies no game files');
    assert.equal(second.storage[0].reused, 1);
    const manifest = saved.get(`runs/${second.run}/storage-manifests/assets.json`);
    assert.equal(manifest[0].backup.name, name);
    assert.equal(manifest[0].backup.generation, '456');
    assert.equal(manifest[0].source.name, 'games/a/file.json');

    const nextPeriod = new Date(now.getTime() + OBJECT_PERIOD_DAYS * 86400000);
    await runBackup(config, api, { now: () => nextPeriod });
    assert.equal(storageCopies(actions).length, 2, 'a new period archives a fresh copy');
  });

  it('copies a changed generation again and never backs up staged uploads', async () => {
    const staged = { ...assetFile, name: 'staged-uploads/u/x.cgs.zip' };
    const changed = { ...assetFile, generation: '456' };
    const { api, saved, copied } = fakeCloud({ assets: [assetFile, staged] });
    await runBackup(config, api, { now: () => now });
    assert.ok(![...copied.keys()].some((key) => key.includes('staged-uploads/')));

    const { api: changedApi, copied: changedCopies } = fakeCloud({ assets: [changed] });
    for (const [key, value] of copied) changedCopies.set(key, value);
    const manifest = await runBackup(config, changedApi, { now: () => now });
    assert.equal(manifest.storage[0].copied, 1);
    assert.ok(changedCopies.has(`objects/p${objectPeriod(now)}/assets/456/games/a/file.json`));
    assert.equal([...saved.keys()].filter((key) => key.includes('staged-uploads')).length, 0);
  });

  it('refuses to reuse an archived copy whose checksum does not match the source', async () => {
    const { api, copied } = fakeCloud();
    await runBackup(config, api, { now: () => now });
    for (const value of copied.values()) value.crc32c = 'corrupted';
    await assert.rejects(() => runBackup(config, api, { now: () => now }), /checksum or size/);
  });

  it('fails a restore drill that imports an empty collection', async () => {
    const { api, saved, actions } = fakeCloud({ restoredCount: '0' });
    await runBackup(config, api, { now: () => now });
    await assert.rejects(
      () => verifyBackup({ ...config, restoreBucket: 'restore-test' }, api, { now }),
      /no users documents/,
    );
    assert.equal(actions.filter((action) => action.method === 'DELETE').length, 0);
    assert.ok(![...saved.keys()].some((key) => key.startsWith('verified/')));
  });

  it('fails a restore drill that imports fewer documents than were exported', async () => {
    const { api, saved } = fakeCloud({ importedDocuments: '12' });
    await runBackup(config, api, { now: () => now });
    await assert.rejects(
      () => verifyBackup({ ...config, restoreBucket: 'restore-test' }, api, { now }),
      /fewer documents/,
    );
    assert.ok(![...saved.keys()].some((key) => key.startsWith('verified/')));
  });

  it('restores reused archive objects pinned to their archived generation', async () => {
    const { api, actions } = fakeCloud();
    await runBackup(config, api, { now: () => now });
    await runBackup(config, api, { now: () => new Date(now.getTime() + 3600000) });
    const report = await verifyBackup({ ...config, restoreBucket: 'restore-test' }, api, {
      now: new Date(now.getTime() + 7200000),
    });
    assert.equal(report.filesRestored, 1);
    assert.equal(report.documentsImported, 1480);
    const restoreCopy = actions.find(({ path }) => path.includes('/rewriteTo/b/restore-test/'));
    assert.match(restoreCopy.path, /\/b\/archive\/o\/objects\/p\d+\/assets\/123\//);
  });

  it('refuses drills pointing at production and alerts on missing restore checks', async () => {
    await assert.rejects(
      () => verifyBackup({ ...config, restoreBucket: 'assets' }, async () => ({})),
      /isolated/,
    );
    await assert.rejects(() => checkRestore(config, async () => ({}), now), /35 days/);
  });
});
