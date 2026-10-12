import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

const address = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '';
assert.match(address, /^(127\.0\.0\.1|localhost):\d+$/);
const [host, port] = address.split(':');
let environment;
const bytes = new Uint8Array([80, 75, 3, 4]);
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-cgs-username-tests',
    storage: { host, port: Number(port), rules: readFileSync('storage.rules', 'utf8') },
  });
});
after(async () => environment?.cleanup());
beforeEach(async () => {
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();
    await storage.ref('staged-uploads/alice/archive.cgs.zip').put(bytes);
    await storage.ref('games/alice/original/Card.png').put(bytes);
  });
});
const reference = (uid, path) =>
  (uid ? environment.authenticatedContext(uid) : environment.unauthenticatedContext())
    .storage()
    .ref(path);

describe('Storage ownership isolation', () => {
  it('allows a user to create, replace, and delete only their own staged ZIP', async () => {
    const ref = reference('alice', 'staged-uploads/alice/new.cgs.zip');
    await assertSucceeds(ref.put(bytes));
    await assertSucceeds(ref.put(bytes));
    await assertSucceeds(ref.delete());
  });
  for (const uid of ['bob', null])
    it(`rejects cross-account staged create, overwrite, metadata update and delete for ${uid}`, async () => {
      const existing = reference(uid, 'staged-uploads/alice/archive.cgs.zip');
      await assertFails(reference(uid, 'staged-uploads/alice/new.cgs.zip').put(bytes));
      await assertFails(existing.put(bytes));
      await assertFails(existing.updateMetadata({ customMetadata: { owner: 'bob' } }));
      await assertFails(existing.delete());
    });
  for (const uid of ['alice', 'bob', null])
    it(`denies staged reads, published writes and unknown paths for ${uid}`, async () => {
      await assertFails(reference(uid, 'staged-uploads/alice/archive.cgs.zip').getMetadata());
      await assertFails(reference(uid, 'staged-uploads').listAll());
      const published = reference(uid, 'games/alice/original/Card.png');
      await assertSucceeds(published.getMetadata());
      await assertFails(published.put(bytes));
      await assertFails(published.delete());
      await assertFails(
        published.updateMetadata({ customMetadata: { firebaseStorageDownloadTokens: 'attacker' } }),
      );
      await assertFails(reference(uid, 'private/secret').put(bytes));
      await assertFails(reference(uid, 'private/secret').getMetadata());
    });
  it('rejects wrong filename and nested staging paths even for the owner', async () => {
    for (const path of [
      'staged-uploads/alice/bad.exe',
      'staged-uploads/alice/sub/archive.cgs.zip',
      'staged-uploads/alice/archive.zip',
    ])
      await assertFails(reference('alice', path).put(bytes));
  });
});
