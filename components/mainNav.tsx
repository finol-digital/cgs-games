"use client";

import Image from "next/image";
import Link from "next/link";

export default function MainNav() {
  return (
    <nav className="hidden md:flex items-center">
      <Link href="/" className="flex items-center ml-4">
        <Image
          className="right-12"
          src="/cgs.png"
          height="48"
          width="48"
          alt="[CGS]"
        />
        CGS Games
      </Link>
      <div className="flex items-center gap-3 lg:gap-4 ml-12">
        <Link href="/browse">Browse</Link>
        <Link href="/upload">Upload</Link>
      </div>
    </nav>
  );
}
