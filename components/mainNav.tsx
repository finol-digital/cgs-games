'use client';

import Image from 'next/image';
import Link from 'next/link';
import cgsLogo from '@/public/cgs.png';

/** Renders desktop navigation with an optimized logo and on-demand upload navigation. */
export default function MainNav() {
  return (
    <nav className="hidden md:flex items-center">
      <Link href="/" className="brownlink flex items-center ml-12">
        <Image className="right-12" src={cgsLogo} height={48} width={48} sizes="48px" alt="[CGS]" />
        <b className="brownlink">CGS Games</b>
      </Link>
      <div className="flex items-center gap-3 lg:gap-4 ml-8">
        <Link href="/browse" className="brownlink">
          <b className="brownlink">Browse</b>
        </Link>
        <Link href="/upload" prefetch={false} className="brownlink">
          <b className="brownlink">Upload</b>
        </Link>
      </div>
    </nav>
  );
}
