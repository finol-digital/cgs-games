import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { apiError } from '@/lib/httpResponses';

/** Listings a single creator may publish, across URL and archive uploads. */
export const MAX_GAMES_PER_USER = 50;
/** Published archive bytes a single creator may store, across all of their games. */
export const MAX_USER_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GiB

/** Counts the creator's listings with a single aggregation read. */
export async function countGamesFor(username: string): Promise<number> {
  const snapshot = await adminDb
    .collection('games')
    .where('username', '==', username)
    .count()
    .get();
  return snapshot.data().count;
}

/** The structured error returned when a creator already has the maximum number of listings. */
export function gameQuotaResponse() {
  return apiError(`You can publish at most ${MAX_GAMES_PER_USER} games`, 403, undefined, {
    code: 'GAME_QUOTA_EXCEEDED',
    hint: 'Delete one of your existing games before publishing another.',
  });
}

/** Sums the sizes of every published asset stored beneath the creator's UID. */
export async function storedBytesFor(uid: string): Promise<number> {
  const [files] = await adminStorage.bucket().getFiles({ prefix: `games/${uid}/` });
  return files.reduce((total, file) => total + Number(file.metadata?.size ?? 0), 0);
}
