import { db } from '@/lib/firebase/firebase';
import {
  Query,
  QueryDocumentSnapshot,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

export async function getAllGames() {
  const gamesQuery = query(collection(db, 'games'));
  const results = await getLatestDocs(gamesQuery, 100);
  return results.docs.map((doc) => game(doc));
}
export async function getGamesFor(username: string) {
  const gamesUsernameQuery = query(collection(db, 'games'), where('username', '==', username));
  const results = await getLatestDocs(gamesUsernameQuery, 100);
  return results.docs.map((doc) => game(doc));
}

export async function getGames(limit: number) {
  const gamesQuery = query(collection(db, 'games'));
  const results = await getLatestDocs(gamesQuery, limit);
  return results.docs.map((doc) => game(doc));
}

export async function getGame(username: string, slug: string) {
  const encodedSlug = encodeURI(slug);
  const gamesUsernameQuery = query(collection(db, 'games'), where('username', '==', username));

  const encodedResults = await getDocs(
    query(
      gamesUsernameQuery,
      where('slug', '==', encodedSlug),
      orderBy('uploadedAt', 'desc'),
      limit(1),
    ),
  );
  const encodedMatch = encodedResults.docs.map((doc) => game(doc))?.at(0);
  if (encodedMatch) return encodedMatch;

  if (encodedSlug === slug) return undefined;

  const rawResults = await getDocs(
    query(gamesUsernameQuery, where('slug', '==', slug), orderBy('uploadedAt', 'desc'), limit(1)),
  );
  return rawResults.docs.map((doc) => game(doc))?.at(0);
}

function game(doc: QueryDocumentSnapshot) {
  return {
    id: doc.id,
    username: doc.get('username'),
    slug: doc.get('slug'),
    name: doc.get('name'),
    bannerImageUrl: doc.get('bannerImageUrl'),
    autoUpdateUrl: doc.get('autoUpdateUrl'),
    copyright: doc.get('copyright'),
    uploadedAt: doc.get('uploadedAt').toDate(),
  };
}

async function getLatestDocs(unfilteredQuery: Query, count: number) {
  return getDocs(query(unfilteredQuery, orderBy('uploadedAt', 'desc'), limit(count)));
}

export function userDoc(uid: string) {
  return doc(db, 'users', uid);
}
