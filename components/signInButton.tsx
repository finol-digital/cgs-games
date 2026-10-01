'use client';

import { signInWithGoogle } from '@/lib/firebase/auth';
import Image from 'next/image';
import googleLogo from '@/public/google.png';

/** Starts Google popup authentication on click and displays a size-appropriate provider icon. */
export default function SignInButton() {
  return (
    <button className="bg-white h-10 flex items-center text-black" onClick={signInWithGoogle}>
      <Image
        className="h-8 w-8 mr-10"
        src={googleLogo}
        height={32}
        width={32}
        sizes="32px"
        alt="Sign in with Google"
      />{' '}
      Sign in with Google
    </button>
  );
}
