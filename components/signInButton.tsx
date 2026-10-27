'use client';

import { signInWithGoogle } from '@/lib/firebase/auth';
import Image from 'next/image';
import googleLogo from '@/public/google.png';

/** Starts Google popup authentication on click and displays a size-appropriate provider icon. */
export default function SignInButton() {
  return (
    <button
      className="m-0! flex h-10 shrink-0 items-center gap-2 bg-white! px-3! py-2! text-black!"
      onClick={signInWithGoogle}
      aria-label="Sign in with Google"
    >
      <Image className="h-6 w-6" src={googleLogo} height={32} width={32} sizes="32px" alt="" />{' '}
      <span>
        Sign in<span className="hidden xl:inline"> with Google</span>
      </span>
    </button>
  );
}
