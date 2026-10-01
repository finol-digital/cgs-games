import {
  GoogleAuthProvider,
  NextOrObserver,
  User,
  onAuthStateChanged as _onAuthStateChanged,
  signInWithPopup,
  browserPopupRedirectResolver,
} from 'firebase/auth';

import { auth } from '@/lib/firebase/firebase';

export function onAuthStateChanged(cb: NextOrObserver<User>) {
  return _onAuthStateChanged(auth, cb);
}

/** Starts Google sign-in with popup support deferred until this user-initiated action. */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  } catch (error) {
    console.error('Error signing in with Google', error);
  }
}

export async function signOut() {
  try {
    return auth.signOut();
  } catch (error) {
    console.error('Error signing out with Google', error);
  }
}
