import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
let environment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-cgs-username-tests',
    firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => environment?.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const uid of ['alice', 'bob']) {
      await setDoc(doc(db, 'users', uid), { username: uid });
      await setDoc(doc(db, 'usernames', uid), { uid });
    }
    await setDoc(doc(db, 'games', 'alice-game'), {
      username: 'alice',
      slug: 'original',
      name: 'Original',
      autoUpdateUrl: 'https://example.test/cgs.json',
      storageBasePath: 'games/alice/original',
      uploadedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'gatcg_ocr_cache', 'card'), { effect_raw: 'server-only' });
    await setDoc(doc(db, 'gatcg_spoiler_cache', 'current'), { payload: '[]' });
  });
});
const client = (uid) =>
  (uid ? environment.authenticatedContext(uid) : environment.unauthenticatedContext()).firestore();

describe('cross-account data isolation', () => {
  it('rejects replacing another creator game while changing username to the attacker', async () => {
    await assertFails(
      setDoc(doc(client('bob'), 'games', 'alice-game'), {
        username: 'bob',
        slug: 'stolen',
        name: 'Stolen',
        autoUpdateUrl: 'https://evil.test/cgs.json',
        uploadedAt: serverTimestamp(),
      }),
    );
  });
  it('rejects inserting a forged Storage deletion target through a direct game write', async () => {
    await assertFails(
      setDoc(doc(client('bob'), 'games', 'forged'), {
        username: 'bob',
        slug: 'forged',
        name: 'Forged',
        autoUpdateUrl: 'https://example.test/cgs.json',
        storageBasePath: 'games/alice',
        uploadedAt: serverTimestamp(),
      }),
    );
  });
  for (const uid of ['alice', 'bob', null]) {
    it(`requires the authorized server API for every game write by ${uid}`, async () => {
      const db = client(uid);
      await assertFails(
        updateDoc(doc(db, 'games', 'alice-game'), {
          name: 'Changed',
          uploadedAt: serverTimestamp(),
        }),
      );
      await assertFails(deleteDoc(doc(db, 'games', 'alice-game')));
      await assertFails(
        setDoc(doc(db, 'games', 'new'), {
          username: uid,
          slug: 'new',
          name: 'New',
          autoUpdateUrl: 'https://example.test/cgs.json',
          uploadedAt: serverTimestamp(),
        }),
      );
      await assertSucceeds(getDoc(doc(db, 'games', 'alice-game')));
    });
    it(`denies cache, unknown collection, and nested collection access for ${uid}`, async () => {
      const db = client(uid);
      for (const path of [
        'gatcg_ocr_cache/card',
        'gatcg_spoiler_cache/current',
        'private/secret',
        'private/root/games/nested',
        'private/root/users/alice',
        'private/root/usernames/alice',
      ]) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(
          setDoc(doc(db, path), {
            username: uid,
            uid,
            slug: 'new',
            name: 'New',
            autoUpdateUrl: 'https://example.test/cgs.json',
            uploadedAt: serverTimestamp(),
          }),
        );
        await assertFails(deleteDoc(doc(db, path)));
      }
    });
  }
  it('restricts private profile reads and forbids profile enumeration', async () => {
    await assertSucceeds(getDoc(doc(client('alice'), 'users', 'alice')));
    await assertFails(getDoc(doc(client('bob'), 'users', 'alice')));
    await assertFails(getDoc(doc(client(null), 'users', 'alice')));
    await assertFails(getDocs(collection(client('alice'), 'users')));
    await assertSucceeds(getDoc(doc(client(null), 'usernames', 'alice')));
    await assertFails(getDocs(collection(client('alice'), 'usernames')));
  });
  it('forbids changing or deleting another profile/registry, and forbids owner reassignment', async () => {
    for (const uid of ['alice', 'bob'])
      for (const path of ['users/alice', 'usernames/alice']) {
        await assertFails(updateDoc(doc(client(uid), path), { uid: 'bob', username: 'bob' }));
        await assertFails(deleteDoc(doc(client(uid), path)));
      }
  });
  it('rejects self-created profile privilege fields', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'usernames', 'charlie'), { uid: 'charlie' });
    });
    await assertFails(
      setDoc(doc(client('charlie'), 'users', 'charlie'), { username: 'charlie', admin: true }),
    );
  });
});
