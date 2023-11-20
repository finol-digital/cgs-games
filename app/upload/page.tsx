import Footer from "@/components/footer";
import Header from "@/components/header";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CGS Games Upload",
  description: "Upload your CGS game.",
  openGraph: {
    title: "CGS Games Upload",
    description: "Upload your CGS game.",
  },
};

export default async function Page() {
  const user = null;
  const username = null;
  // 1. user signed out <SignInButton />
  // 2. user signed in, but missing username <UsernameForm />
  // 3. user signed in, has username <SignOutButton />
  return (
    <main className="main-container">
      <Header title="CGS Games Upload" />
      {user ? (
        !username ? (
          <UsernameForm />
        ) : (
          <SignOutButton />
        )
      ) : (
        <SignInButton />
      )}

      <Footer />
    </main>
  );
}

// Sign in with Google button
function SignInButton() {
  return (
    <button className="btn-google" onClick={signInWithGoogle}>
      <img src={"/google.png"} alt="Sign in with Google" /> Sign in with Google
    </button>
  );
}

// Allow setting their own username
function UsernameForm() {
  return null;
}

// Sign out button
function SignOutButton() {
  return <button onClick={() => signOut()}>Sign Out</button>;
}
