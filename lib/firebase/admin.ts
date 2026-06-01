import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const apps = getApps();

if (!apps.length) {
  try {
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
    const privateKeyLen = process.env.FIREBASE_PRIVATE_KEY?.length || 0;
    console.info('Initializing Firebase admin app', {
      hasProjectId,
      hasClientEmail,
      hasPrivateKey,
      privateKeyLen: hasPrivateKey ? privateKeyLen : 0,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } catch (err) {
    console.error('Failed to initialize Firebase admin app', err);
    throw err;
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminStorage = getStorage();

import Game from '@/lib/game';

function gameFromDoc(doc: QueryDocumentSnapshot): Game {
  const data = doc.data();
  return {
    id: doc.id,
    username: data.username,
    slug: data.slug,
    name: data.name,
    bannerImageUrl: data.bannerImageUrl,
    autoUpdateUrl: data.autoUpdateUrl,
    copyright: data.copyright,
    uploadedAt: data.uploadedAt.toDate(),
  };
}

export async function adminGetAllGames(): Promise<Game[]> {
  const snapshot = await adminDb.collection('games').orderBy('uploadedAt', 'desc').limit(100).get();
  return snapshot.docs.map(gameFromDoc);
}

export async function adminGetGamesFor(username: string): Promise<Game[]> {
  const snapshot = await adminDb
    .collection('games')
    .where('username', '==', username)
    .orderBy('uploadedAt', 'desc')
    .limit(100)
    .get();
  return snapshot.docs.map(gameFromDoc);
}

export async function adminGetGames(count: number): Promise<Game[]> {
  const snapshot = await adminDb
    .collection('games')
    .orderBy('uploadedAt', 'desc')
    .limit(count)
    .get();
  return snapshot.docs.map(gameFromDoc);
}

export async function adminGetGame(username: string, slug: string): Promise<Game | undefined> {
  const encodedSlug = encodeURIComponent(slug);
  const encodedSnapshot = await adminDb
    .collection('games')
    .where('username', '==', username)
    .where('slug', '==', encodedSlug)
    .orderBy('uploadedAt', 'desc')
    .limit(1)
    .get();
  if (!encodedSnapshot.empty) return gameFromDoc(encodedSnapshot.docs[0]);

  if (encodedSlug === slug) return undefined;

  const rawSnapshot = await adminDb
    .collection('games')
    .where('username', '==', username)
    .where('slug', '==', slug)
    .orderBy('uploadedAt', 'desc')
    .limit(1)
    .get();
  return rawSnapshot.empty ? undefined : gameFromDoc(rawSnapshot.docs[0]);
}

const OCR_CACHE_COLLECTION = 'gatcg_ocr_cache';
const OCR_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface OcrCacheEntry {
  effect_raw: string;
  imageUrl: string;
  cachedAt: Timestamp;
}

/**
 * Get a cached OCR result for a spoiler card from Firestore.
 * Returns the cached text if fresh and the image URL matches, otherwise null.
 */
export async function getCachedOcrResult(
  spoilerId: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const docRef = adminDb.collection(OCR_CACHE_COLLECTION).doc(spoilerId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() as OcrCacheEntry;
    if (data.imageUrl !== imageUrl) return null;

    const cachedAtMs = data.cachedAt.toMillis();
    if (Date.now() - cachedAtMs > OCR_CACHE_TTL_MS) return null;

    return data.effect_raw;
  } catch (error) {
    console.error(`Firestore OCR cache read failed for ${spoilerId}:`, error);
    return null;
  }
}

/**
 * Store an OCR result for a spoiler card in Firestore.
 */
export async function setCachedOcrResult(
  spoilerId: string,
  imageUrl: string,
  effectRaw: string,
): Promise<void> {
  try {
    const docRef = adminDb.collection(OCR_CACHE_COLLECTION).doc(spoilerId);
    await docRef.set({
      effect_raw: effectRaw,
      imageUrl,
      cachedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Firestore OCR cache write failed for ${spoilerId}:`, error);
  }
}
