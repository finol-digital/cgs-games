"use client";

import { signOut } from "@/lib/firebase/auth";
import Link from "next/link";

export default function UserMenu({ username }: { username: string }) {
  return (
    <div className="flex items-center">
      <Link href={`/${username}`}>{username}</Link>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
