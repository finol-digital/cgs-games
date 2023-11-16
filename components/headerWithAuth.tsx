"use client";

import {
  onAuthStateChanged,
  signInWithGoogle,
  signOut,
} from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Banner from "./banner";

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

export default function HeaderWithAuth({
  initialUser,
  title = "",
}: {
  initialUser: any;
  title?: string;
}) {
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
    <header>
      <Banner />
      {user ? (
        <>
          <div className="profile">
            <p>
              <img src="/profile.svg" alt={user.email} />
              {user.displayName}
            </p>
            <div className="menu">
              ...
              <ul>
                <li>{user.displayName}</li>
                <li>
                  <a href="#" onClick={() => console.log("clicked")}>
                    Log click
                  </a>
                </li>
                <li>
                  <a href="#" onClick={handleSignOut}>
                    Sign Out
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </>
      ) : (
        <a href="#" onClick={handleSignIn}>
          Sign In with Google
        </a>
      )}
      <hr />
      {title && <h1>{title}</h1>}
    </header>
  );
}
