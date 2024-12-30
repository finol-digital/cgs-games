"use client";

import Image from "next/image";
import Link from "next/link";

export default function MainNav() {
  return (
    <nav className="hidden md:flex items-center">
      <Link href="/" className="flex items-center ml-12">
        <Image
          className="right-12"
          src="/cgs.png"
          height="48"
          width="48"
          alt="[CGS]"
        />
        <b>CGS Games</b>
      </Link>
      <div className="flex items-center gap-3 lg:gap-4 ml-8">
        <Link href="/browse">
          <b>Browse</b>
        </Link>
        <Link href="/upload">
          <b>Upload</b>
        </Link>
      </div>
    </nav>
  );
}
