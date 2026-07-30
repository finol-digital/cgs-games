import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  DocumentData,
  FieldValue,
  getFirestore,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const apps = getApps();

if (!apps.length) {
  try {
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
    console.info('Initializing Firebase admin app', {
      hasProjectId,
      hasClientEmail,
      hasPrivateKey,
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
const SPOILER_PAYLOAD_COLLECTION = 'gatcg_spoiler_cache';
const SPOILER_PAYLOAD_DOC = 'current';

/**
 * Bump this when the OCR pipeline changes in a way that invalidates already
 * extracted text (crop region, preprocessing, tesseract options, ...). It is
 * the only way cached text for an unchanged image is ever discarded.
 */
export const OCR_VERSION = 1;

/**
 * OCR text is a pure function of the card image, so a successful result never
 * expires on its own: it is invalidated by a change of image URL or of
 * OCR_VERSION. A time-based TTL would expire every card at once and force a
 * single unlucky request to re-OCR the whole set.
 *
 * Cards whose OCR produced nothing are cached too, so an unreadable card
 * cannot burn the OCR budget of every request, but they are retried after this
 * backoff in case the failure was transient (image fetch error, bad crop).
 */
const OCR_FAILURE_RETRY_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Firestore caps documents at 1 MiB; stay well clear of it. */
const MAX_PAYLOAD_BYTES = 900_000;

/** Documents fetched per getAll() round trip. */
const GET_ALL_CHUNK_SIZE = 300;

interface OcrCacheEntry {
  effect_raw: string;
  imageUrl: string;
  cachedAt: Timestamp;
  ocrVersion?: number;
  failedAttempts?: number;
}

export interface OcrCacheRequest {
  spoilerId: string;
  imageUrl: string;
}

export interface OcrCacheResult {
  spoilerId: string;
  imageUrl: string;
  effectRaw: string;
}

/**
 * Read cached OCR results for many spoiler cards in as few round trips as
 * possible. Returns a map of spoiler id to cached text; an entry is present
 * only when it is still usable for the requested image URL, so any card
 * missing from the map needs OCR. An empty string means "OCR already ran and
 * found nothing recently" - don't retry it yet.
 */
export async function getCachedOcrResults(
  requests: OcrCacheRequest[],
): Promise<Map<string, string>> {
  const usable = new Map<string, string>();
  if (requests.length === 0) return usable;

  const requestedImageUrls = new Map(requests.map((r) => [r.spoilerId, r.imageUrl]));
  const spoilerIds = Array.from(requestedImageUrls.keys());

  try {
    for (let start = 0; start < spoilerIds.length; start += GET_ALL_CHUNK_SIZE) {
      const refs = spoilerIds
        .slice(start, start + GET_ALL_CHUNK_SIZE)
        .map((id) => adminDb.collection(OCR_CACHE_COLLECTION).doc(id));
      const snapshots = await adminDb.getAll(...refs);

      for (const snapshot of snapshots) {
        if (!snapshot.exists) continue;

        const data = snapshot.data() as OcrCacheEntry;
        if (data.imageUrl !== requestedImageUrls.get(snapshot.id)) continue;
        if ((data.ocrVersion ?? 0) !== OCR_VERSION) continue;

        if (!data.effect_raw) {
          const cachedAtMs = data.cachedAt?.toMillis() ?? 0;
          if (Date.now() - cachedAtMs > OCR_FAILURE_RETRY_MS) continue;
        }

        usable.set(snapshot.id, data.effect_raw ?? '');
      }
    }
  } catch (error) {
    // A cache read failure just means more OCR work, never a failed request.
    console.error('Firestore OCR cache read failed:', error);
  }

  return usable;
}

/**
 * Store OCR results for many spoiler cards in a single batched write.
 */
export async function setCachedOcrResults(results: OcrCacheResult[]): Promise<void> {
  if (results.length === 0) return;

  try {
    const writer = adminDb.bulkWriter();
    for (const result of results) {
      const entry: DocumentData = {
        effect_raw: result.effectRaw,
        imageUrl: result.imageUrl,
        cachedAt: Timestamp.now(),
        ocrVersion: OCR_VERSION,
        failedAttempts: result.effectRaw ? 0 : FieldValue.increment(1),
      };
      writer
        .set(adminDb.collection(OCR_CACHE_COLLECTION).doc(result.spoilerId), entry, { merge: true })
        .catch((error) =>
          console.error(`Firestore OCR cache write failed for ${result.spoilerId}:`, error),
        );
    }
    await writer.close();
  } catch (error) {
    console.error('Firestore OCR cache batch write failed:', error);
  }
}

export interface CachedSpoilerPayload {
  /** Serialized response body, ready to return as-is. */
  payload: string;
  ageMs: number;
  /** Cards in the payload still awaiting OCR text when it was built. */
  pendingOcrCount: number;
  cardCount: number;
}

interface SpoilerPayloadEntry {
  payload: string;
  cachedAt: Timestamp;
  pendingOcrCount?: number;
  cardCount?: number;
}

/**
 * Read the fully assembled spoiler response cached in Firestore. This is the
 * hot path: one document read serves a complete response without touching the
 * upstream API or tesseract.
 */
export async function getCachedSpoilerPayload(): Promise<CachedSpoilerPayload | null> {
  try {
    const snapshot = await adminDb
      .collection(SPOILER_PAYLOAD_COLLECTION)
      .doc(SPOILER_PAYLOAD_DOC)
      .get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() as SpoilerPayloadEntry;
    if (!data.payload) return null;

    return {
      payload: data.payload,
      ageMs: Math.max(0, Date.now() - (data.cachedAt?.toMillis() ?? 0)),
      pendingOcrCount: data.pendingOcrCount ?? 0,
      cardCount: data.cardCount ?? 0,
    };
  } catch (error) {
    console.error('Firestore spoiler payload cache read failed:', error);
    return null;
  }
}

/**
 * Store the assembled spoiler response so later requests can skip the rebuild.
 */
export async function setCachedSpoilerPayload(entry: {
  payload: string;
  pendingOcrCount: number;
  cardCount: number;
}): Promise<void> {
  const payloadBytes = Buffer.byteLength(entry.payload, 'utf8');
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    console.warn(
      `Spoiler payload of ${payloadBytes} bytes exceeds the ${MAX_PAYLOAD_BYTES} byte cache limit; skipping write`,
    );
    return;
  }

  try {
    await adminDb.collection(SPOILER_PAYLOAD_COLLECTION).doc(SPOILER_PAYLOAD_DOC).set({
      payload: entry.payload,
      cachedAt: Timestamp.now(),
      pendingOcrCount: entry.pendingOcrCount,
      cardCount: entry.cardCount,
    });
  } catch (error) {
    console.error('Firestore spoiler payload cache write failed:', error);
  }
}
