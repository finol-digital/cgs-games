"use client";

import { signInWithGoogle } from "@/lib/firebase/auth";

export default function SignInButton() {
  return (
    <button
      className="bg-white h-10 flex items-center"
      onClick={signInWithGoogle}
    >
      <img
        className="h-8 w-8 mr-10"
        src="/google.png"
        alt="Sign in with Google"
      />{" "}
      Sign in with Google
    </button>
  );
}
