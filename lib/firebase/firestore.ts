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

async function getLatestDocs(unfilteredQuery: Query, count: number, context: string) {
  try {
    return await getDocs(query(unfilteredQuery, orderBy('uploadedAt', 'desc'), limit(count)));
  } catch (error) {
    console.error(`Failed to fetch latest documents for ${context} (count: ${count}).`, error);
    throw error;
  }
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

export async function getAllGames() {
  const gamesQuery = query(collection(db, 'games'));
  const results = await getLatestDocs(gamesQuery, 100, 'getAllGames');
  return results.docs.map((doc) => game(doc));
}
export async function getGamesFor(username: string) {
  const gamesUsernameQuery = query(collection(db, 'games'), where('username', '==', username));
  const results = await getLatestDocs(
    gamesUsernameQuery,
    100,
    `getGamesFor (username: ${username})`,
  );
  return results.docs.map((doc) => game(doc));
}

export async function getGames(limit: number) {
  const gamesQuery = query(collection(db, 'games'));
  const results = await getLatestDocs(gamesQuery, limit, `getGames (limit: ${limit})`);
  return results.docs.map((doc) => game(doc));
}

export async function getGame(username: string, slug: string) {
  const encodedSlug = encodeURIComponent(slug);
  const gamesUsernameQuery = query(collection(db, 'games'), where('username', '==', username));
  let encodedLookupError: unknown;

  try {
    const encodedResults = await getDocs(
      query(
        gamesUsernameQuery,
        where('slug', '==', encodedSlug),
        orderBy('uploadedAt', 'desc'),
        limit(1),
      ),
    );
    const encodedDoc = encodedResults.docs[0];
    const encodedMatch = encodedDoc ? game(encodedDoc) : undefined;
    if (encodedMatch) return encodedMatch;
  } catch (error) {
    console.error(
      `Failed to fetch game by encoded slug "${encodedSlug}" for username "${username}".`,
      error,
    );
    encodedLookupError = error;
  }

  if (encodedSlug === slug) {
    if (encodedLookupError) throw encodedLookupError;
    return undefined;
  }

  try {
    const rawResults = await getDocs(
      query(gamesUsernameQuery, where('slug', '==', slug), orderBy('uploadedAt', 'desc'), limit(1)),
    );
    const rawDoc = rawResults.docs[0];
    return rawDoc ? game(rawDoc) : undefined;
  } catch (error) {
    console.error(`Failed to fetch game by raw slug "${slug}" for username "${username}".`, error);
    throw error;
  }
}

export function userDoc(uid: string) {
  return doc(db, 'users', uid);
}
