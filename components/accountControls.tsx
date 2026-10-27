'use client';

import { useContext } from 'react';
import Link from 'next/link';
import { UserContext } from '@/lib/context';
import SignInButton from '@/components/signInButton';
import UserMenu from '@/components/userMenu';

/** Updates account actions without hydrating the static navigation. */
export default function AccountControls() {
  const { user, username } = useContext(UserContext);
  return (
    <div className="ml-auto flex min-w-0 items-center justify-end">
      {user ? (
        username ? (
          <UserMenu username={username} />
        ) : (
          <Link href="/upload" prefetch={false} className="brownlink">
            Upload Username
          </Link>
        )
      ) : (
        <SignInButton />
      )}
    </div>
  );
}
