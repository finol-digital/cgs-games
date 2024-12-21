"use client";

import Link from "next/link";

export default function MobileNav() {
  return (
    <nav className="md:hidden">
      <Link href="/" className="flex items-center ml-4">
        <img
          className="right-12"
          // img instead of next/Image
          src="/cgs.png"
          height="48"
          alt="[CGS]"
          //priority={true}
        />
        CGS Games
      </Link>
    </nav>
  );
}
