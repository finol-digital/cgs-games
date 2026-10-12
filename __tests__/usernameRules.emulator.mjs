import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';

// Never fall back to a real project or a remotely supplied emulator host.
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const reserved = JSON.parse(readFileSync('lib/reservedUsernames.json', 'utf8'));
let environment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-cgs-username-tests',
    firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(async () => environment.clearFirestore());
after(async () => environment?.cleanup());

/** Uses the same atomic two-document registration as the browser, without its validation. */
function register(username, uid = 'creator', authenticated = true) {
  const db = (
    authenticated ? environment.authenticatedContext(uid) : environment.unauthenticatedContext()
  ).firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), { username });
  batch.set(doc(db, 'usernames', username), { uid });
  return batch.commit();
}

describe('Firestore username creation rules', () => {
  for (const name of reserved) {
    it(`rejects direct registration of ${name}`, async () => assertFails(register(name)));
  }
  for (const name of [
    'abc',
    'my-game',
    'my_game',
    'my.game',
    '-ab',
    'ab-',
    'a'.repeat(15),
    'games',
    'session',
    'sandbox',
  ]) {
    it(`allows valid registration of ${name}`, async () => assertSucceeds(register(name)));
  }
  for (const name of [
    'ab',
    'a'.repeat(16),
    'Alice',
    '.abc',
    'abc_',
    'a..b',
    'a_.b',
    'a__b',
    'a b',
    'a%b',
    'abc\n',
  ]) {
    it(`rejects malformed registration of ${JSON.stringify(name)}`, async () =>
      assertFails(register(name)));
  }
  it('rejects unauthenticated registration', async () =>
    assertFails(register('alice', 'creator', false)));
  it('rejects stealing an existing username through a profile-only write', async () => {
    await assertSucceeds(register('alice', 'owner'));
    const db = environment.authenticatedContext('attacker').firestore();
    await assertFails(setDoc(doc(db, 'users', 'attacker'), { username: 'alice' }));
  });
  it('rejects reserved profile-only creation even when a legacy registry entry exists', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'usernames', 'about'), { uid: 'creator' });
    });
    const db = environment.authenticatedContext('creator').firestore();
    await assertFails(setDoc(doc(db, 'users', 'creator'), { username: 'about' }));
  });
  it('rejects registry-only creation and mismatched batch ownership', async () => {
    const db = environment.authenticatedContext('creator').firestore();
    await assertFails(setDoc(doc(db, 'usernames', 'alice'), { uid: 'creator' }));
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'creator'), { username: 'alice' });
    batch.set(doc(db, 'usernames', 'alice'), { uid: 'other' });
    await assertFails(batch.commit());
  });
  it('preserves existing profiles and prevents overwriting a claimed name', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'legacy'), { username: 'about' });
    });
    const db = environment.authenticatedContext('legacy').firestore();
    assert.equal(
      (await assertSucceeds(getDoc(doc(db, 'users', 'legacy')))).data().username,
      'about',
    );
    await assertSucceeds(register('alice', 'owner'));
    await assertFails(register('alice', 'attacker'));
  });
});
