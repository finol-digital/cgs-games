import { auth } from '@/lib/firebase/firebase';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

// Custom hook to read auth record and user profile doc
export function useUserData() {
  const [user] = useAuthState(auth);
  const [profile, setProfile] = useState<{ uid: string; username: string | null } | null>(null);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Anonymous visitors do not need the Firestore SDK or a profile listener.
    void import('@/lib/firebase/firestore')
      .then(({ subscribeToUsername }) => {
        if (cancelled) return;
        unsubscribe = subscribeToUsername(uid, (username) => {
          if (!cancelled) setProfile({ uid, username });
        });
      })
      .catch((error: unknown) => {
        console.error('Failed to load user profile:', error);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid]);

  const username = profile?.uid === uid ? (profile?.username ?? null) : null;
  return { user, username };
}
