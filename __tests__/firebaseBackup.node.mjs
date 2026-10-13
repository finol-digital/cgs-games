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
} from '../scripts/backups/backup.mjs';

const config = configuration({
  SOURCE_PROJECT: 'production',
  BACKUP_PROJECT: 'backups',
  ARCHIVE_BUCKET: 'archive',
  EXPORT_BUCKET: 'staging',
  SOURCE_BUCKETS: 'assets',
});
const now = new Date('2026-10-13T02:00:00Z');

function fakeCloud({ failStorage = false, failImport = false } = {}) {
  const saved = new Map();
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
    if (path.endsWith('/b/assets/o'))
      return {
        items: [
          { name: 'games/a/file.json', generation: '123', size: '12', crc32c: 'test-checksum' },
        ],
      };
    if (path.endsWith('/b/archive/o'))
      return {
        items: [...saved.keys()]
          .filter((key) => key.startsWith(url.searchParams.get('prefix')))
          .map((name) => ({ name, generation: '1', timeCreated: now.toISOString() })),
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
        return { done: true, ...(failImport ? { error: { code: 9 } } : {}) };
      }
      if (path.endsWith(':runAggregationQuery'))
        return [{ result: { aggregateFields: { total: { integerValue: '1' } } } }];
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
  return { api, saved, actions };
}

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

  it('refuses drills pointing at production and alerts on missing restore checks', async () => {
    await assert.rejects(
      () => verifyBackup({ ...config, restoreBucket: 'assets' }, async () => ({})),
      /isolated/,
    );
    await assert.rejects(() => checkRestore(config, async () => ({}), now), /35 days/);
  });
});
