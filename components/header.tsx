"use client";

import MainNav from "./mainNav";

import { UserContext } from "@/lib/context";
import { useContext } from "react";
import SignInButton from "./signInButton";
import UserMenu from "./userMenu";
import UsernameForm from "./usernameForm";

export default function Header() {
  const { user, username } = useContext(UserContext);
  return (
    <header className="bg-[#D3BD7A] sticky top-0 w-full border-b">
      <div className="h-14 container flex items-center">
        <MainNav />
        <div className="flex items-center justify-end flex-1">
          {user ? (
            username ? (
              <UserMenu username={username} />
            ) : (
              <UsernameForm />
            )
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  );
}
