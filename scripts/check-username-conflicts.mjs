import { readFileSync } from 'node:fs';
import process from 'node:process';
import nextEnv from '@next/env';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Read-only pre-deployment audit. Prints only conflicting public names, never credentials or user IDs.
nextEnv.loadEnvConfig(process.cwd());
const reserved = new Set(JSON.parse(readFileSync('lib/reservedUsernames.json', 'utf8')));
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
try {
  const db = getFirestore(app);
  const sources = await Promise.all([
    db.collection('usernames').select().get(),
    db.collection('users').select('username').get(),
    db.collection('games').select('username').get(),
  ]);
  const conflicts = [];
  sources.forEach((snapshot, index) => {
    const names = new Set(
      snapshot.docs.map((document) => (index === 0 ? document.id : document.data().username)),
    );
    for (const name of names) {
      if (typeof name === 'string' && reserved.has(name.toLowerCase()))
        conflicts.push({ username: name, source: ['usernames', 'users', 'games'][index] });
    }
  });
  console.log(
    JSON.stringify({ conflicts, checkedCollections: ['usernames', 'users', 'games'] }, null, 2),
  );
  if (conflicts.length) process.exitCode = 1;
} finally {
  await deleteApp(app);
}
