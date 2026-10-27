'use client';

import { signOut } from '@/lib/firebase/auth';
import Link from 'next/link';

/** Keeps the creator profile and sign-out actions accessible in the responsive header. */
export default function UserMenu({ username }: { username: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <Link href={`/${username}`} className="brownlink max-w-28 truncate" title={username}>
        {username}
      </Link>
      <button className="m-0! shrink-0 px-3! py-2!" onClick={() => signOut()}>
        Sign Out
      </button>
    </div>
  );
}
