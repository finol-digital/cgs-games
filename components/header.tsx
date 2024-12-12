"use client";

import MainNav from "./mainNav";

import { UserContext } from "@/lib/context";
import Link from "next/link";
import { useContext } from "react";
import MobileNav from "./mobileNav";
import SignInButton from "./signInButton";
import UserMenu from "./userMenu";

export default function Header() {
  const { user, username } = useContext(UserContext);
  return (
    <header className="bg-[#D3BD7A] sticky top-0 w-full border-b">
      <div className="h-16 container flex items-center">
        <MainNav />
        <MobileNav />
        <div className="flex items-center justify-end flex-1">
          {user ? (
            username ? (
              <UserMenu username={username} />
            ) : (
              <Link href="/upload">Upload Username</Link>
            )
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  );
}
