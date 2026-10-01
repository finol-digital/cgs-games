import { browserPopupRedirectResolver, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { signInWithGoogle } from '@/lib/firebase/auth';

jest.mock('@/lib/firebase/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn().mockResolvedValue({}),
  browserPopupRedirectResolver: { name: 'popup-resolver' },
}));

it('supplies popup support explicitly when the user signs in', async () => {
  await signInWithGoogle();
  expect(signInWithPopup).toHaveBeenCalledWith(
    auth,
    expect.any(Object),
    browserPopupRedirectResolver,
  );
});
