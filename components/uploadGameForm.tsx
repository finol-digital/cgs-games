"use client";

import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { useContext } from "react";
import { UserContext } from "../lib/context";

function SignInButton() {
  return (
    <button className="btn-google" onClick={signInWithGoogle}>
      <img src={"/google.png"} alt="Sign in with Google" /> Sign in with Google
    </button>
  );
}

export default function UploadGameForm() {
  const { user, username } = useContext(UserContext);
  return (
    <>
      {user ? (
        username ? (
          <SignOutButton />
        ) : (
          <UsernameForm />
        )
      ) : (
        <SignInButton />
      )}
    </>
  );
}

function UsernameForm() {
  return null;
}

function SignOutButton() {
  return <button onClick={() => signOut()}>Sign Out</button>;
}
