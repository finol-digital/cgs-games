'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function MainNav() {
  return (
    <nav className="hidden md:flex items-center">
      <Link href="/" className="brownlink flex items-center ml-12">
        <Image className="right-12" src="/cgs.png" height="48" width="48" alt="[CGS]" />
        <b className="brownlink">CGS Games</b>
      </Link>
      <div className="flex items-center gap-3 lg:gap-4 ml-8">
        <Link href="/browse" className="brownlink">
          <b className="brownlink">Browse</b>
        </Link>
        <Link href="/upload" className="brownlink">
          <b className="brownlink">Upload</b>
        </Link>
      </div>
    </nav>
  );
}
