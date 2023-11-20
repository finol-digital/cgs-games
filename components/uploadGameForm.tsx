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

function SignOutButton() {
  return <button onClick={() => signOut()}>Sign Out</button>;
}

export default function UploadGameForm() {
  const { user, username } = useContext(UserContext);
  return (
    <>
      {user ? (
        !username ? (
          <UsernameForm />
        ) : (
          <SignOutButton />
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
