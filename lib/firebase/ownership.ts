import { adminDb } from '@/lib/firebase/admin';

/** Rejects ambiguous object/document path segments without changing legacy valid usernames. */
export function isOwnershipSegment(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !Array.from(value).some((character) => character.charCodeAt(0) < 32)
  );
}

/** Confirms the immutable username registry agrees with the authenticated user's profile. */
export async function ownsRegisteredUsername(uid: string, username: unknown): Promise<boolean> {
  if (!isOwnershipSegment(uid) || !isOwnershipSegment(username)) return false;
  const registration = await adminDb.collection('usernames').doc(username).get();
  return registration.exists && registration.data()?.uid === uid;
}

/** Legacy listings use the verified registry; new listings additionally bind the immutable UID. */
export function ownsGame(uid: string, username: string, game: Record<string, unknown>): boolean {
  return game.username === username && (game.ownerUid === undefined || game.ownerUid === uid);
}

/** Never trust a database field to choose arbitrary objects for a privileged bulk deletion. */
export function ownedStoragePrefix(uid: string, game: Record<string, unknown>): string | null {
  if (!isOwnershipSegment(uid) || !isOwnershipSegment(game.slug)) return null;
  const expected = `games/${uid}/${game.slug}`;
  return game.storageBasePath === expected ? expected + '/' : null;
}
