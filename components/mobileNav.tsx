"use client";

import Image from "next/image";
import Link from "next/link";

export default function MobileNav() {
  return (
    <nav className="md:hidden">
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
    </nav>
  );
}
