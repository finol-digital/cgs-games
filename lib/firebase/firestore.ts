import { firebaseApp } from '@/lib/firebase/firebase';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';

// Game catalogs are loaded on the server through @/lib/firebase/admin: security rules deny client
// queries of the games collection, which would otherwise enumerate private (unlisted) games.
export const db = getFirestore(firebaseApp);

/** Listens for a user's username, reports null when unavailable, and returns an unsubscribe callback. */
export function subscribeToUsername(
  uid: string,
  // eslint-disable-next-line no-unused-vars -- This parameter describes the callback's type.
  onUsername: (username: string | null) => void,
) {
  return onSnapshot(
    userDoc(uid),
    (snapshot) => onUsername(snapshot.data()?.username ?? null),
    (error) => {
      console.error('Failed to load user profile:', error);
      onUsername(null);
    },
  );
}

export function userDoc(uid: string) {
  return doc(db, 'users', uid);
}
