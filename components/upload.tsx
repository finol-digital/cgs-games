"use client";

import {
  onAuthStateChanged,
  signInWithGoogle,
  signOut,
} from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function useUserSession(initialUser: any) {
  // The initialUser comes from the server via a server component
  const [user, setUser] = useState(initialUser);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((authUser) => {
      setUser(authUser);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onAuthStateChanged((authUser) => {
      if (user === undefined) return;

      // refresh when user changed to ease testing
      if (user?.email !== authUser?.email) {
        router.refresh();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return user;
}

export default function Upload({ initialUser }: { initialUser: any }) {
  const user = useUserSession(initialUser);

  const handleSignOut = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    signOut();
  };

  const handleSignIn = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    signInWithGoogle();
  };

  return (
    <>
      <p>authentication, link to self, and upload functionality</p>
      {user ? (
        <>
          <a href="#" onClick={() => console.log("clicked")}>
            Log click
          </a>
          <a href="#" onClick={handleSignOut}>
            Sign Out
          </a>
        </>
      ) : (
        <a href="#" onClick={handleSignIn}>
          Sign In with Google
        </a>
      )}
    </>
  );
}
