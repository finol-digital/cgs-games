import process from 'node:process';
import nextEnv from '@next/env';
import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { backfillGameVisibility, countGamesWithoutVisibility } from './lib/gameVisibility.mjs';

// Stores visibility on games listed before it existed, so catalogs can query on it.
// Dry run by default; pass --write to update. Safe to rerun: valid documents are left alone.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--write')) {
  console.error('Usage: node scripts/backfill-game-visibility.mjs [--write]');
  process.exit(2);
}
const write = args.includes('--write');

nextEnv.loadEnvConfig(process.cwd());
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('Set FIREBASE_PROJECT_ID to the project to backfill.');
  process.exit(2);
}
// The Admin service account from .env if present, else Application Default Credentials
// (`gcloud auth application-default login`).
const app = initializeApp({
  projectId,
  credential: process.env.FIREBASE_PRIVATE_KEY
    ? cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    : applicationDefault(),
});
try {
  const db = getFirestore(app);
  const summary = await backfillGameVisibility(db, { write });
  const remaining = await countGamesWithoutVisibility(db);
  console.log(JSON.stringify({ project: projectId, ...summary, remaining }, null, 2));
  if (!write && remaining) console.log('Dry run: rerun with --write to update these games.');
  if (write && remaining) {
    console.error('Some games still lack visibility; rerun to retry them.');
    process.exitCode = 1;
  }
} finally {
  await deleteApp(app);
}
