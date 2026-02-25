import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const apps = getApps();

if (!apps.length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();

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
