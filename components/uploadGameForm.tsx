"use client";

import { signInWithGoogle, signOut } from "@/lib/firebase/auth";

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
  const user = null;
  const username = null;
  // 1. user signed out <SignInButton />
  // 2. user signed in, but missing username <UsernameForm />
  // 3. user signed in, has username <SignOutButton />
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
