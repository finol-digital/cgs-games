"use client";

import Link from "next/link";

export default function MainNav() {
  return (
    <nav className="hidden md:flex items-center">
      <Link href="/" className="flex items-center ml-4">
        <img
          className="right-12"
          // img instead of next/Image
          src="cgs.png"
          height="48"
          alt="[CGS]"
          //priority={true}
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
