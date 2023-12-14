"use client";

import { UserContext } from "@/lib/context";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { db } from "@/lib/firebase/firebase";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import debounce from "lodash.debounce";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useState } from "react";

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
          <AutoUpdateUrlForm />
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
  const [formValue, setFormValue] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user, username } = useContext(UserContext);

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    // Create refs for both documents
    const userDoc = doc(db, `users/${user?.uid}`);
    const usernameDoc = doc(db, `usernames/${formValue}`);

    // Commit both docs together as a batch write.
    const batch = writeBatch(db);
    batch.set(userDoc, {
      username: formValue,
    });
    batch.set(usernameDoc, { uid: user?.uid });

    await batch.commit();
  };

  const onChange = (e: { target: { value: string } }) => {
    // Force form value typed in form to match correct format
    const val = e.target.value.toLowerCase();
    const re = /^(?=[a-zA-Z0-9._\-]{3,15}$)(?!.*[_.]{2})[^_.].*[^_.]$/;

    // Only set form value if length is < 3 OR it passes regex
    if (val.length < 3) {
      setFormValue(val);
      setLoading(false);
      setIsValid(false);
    }

    if (re.test(val)) {
      setFormValue(val);
      setLoading(true);
      setIsValid(false);
    }
  };

  // Hit the database for username match after each debounced change
  // useCallback is required for debounce to work
  const checkUsername = useCallback(
    debounce(async (username) => {
      if (username.length >= 3) {
        const ref = doc(db, `usernames/${username}`);
        const exists = (await getDoc(ref)).exists();
        console.log(
          "Firestore read executed! " + username + " exists: " + exists,
        );
        setIsValid(!exists);
        setLoading(false);
      }
    }, 500),
    [],
  );

  useEffect(() => {
    checkUsername(formValue);
  }, [formValue, checkUsername]);

  return (
    !username && (
      <section>
        <h2>Choose Username</h2>
        <form onSubmit={onSubmit}>
          <input
            name="username"
            placeholder="myname"
            value={formValue}
            onChange={onChange}
          />
          <UsernameMessage
            username={formValue}
            isValid={isValid}
            loading={loading}
          />
          <button type="submit" className="btn-green" disabled={!isValid}>
            Choose
          </button>
          <div>
            Username: {formValue}
            <br />
            Loading: {loading.toString()}
            <br />
            Username Valid: {isValid.toString()}
          </div>
        </form>
      </section>
    )
  );
}

function UsernameMessage({
  username,
  isValid,
  loading,
}: {
  username: string;
  isValid: boolean;
  loading: boolean;
}) {
  if (loading) {
    return <p>Checking...</p>;
  } else if (isValid) {
    return <p className="text-success">{username} is available!</p>;
  } else if (username && !isValid) {
    return <p className="text-danger">That username is taken!</p>;
  } else {
    return <p></p>;
  }
}

function isValidHttpUrl(string: string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

function AutoUpdateUrlForm() {
  const router = useRouter();
  const { username } = useContext(UserContext);
  const [autoUpdateUrl, setAutoUpdateUrl] = useState("");

  const isValid = isValidHttpUrl(autoUpdateUrl);

  const submitAutoUpdateUrl = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    // TODO:
    const slug = ""; // TODO: encodeURI(kebabCase(title));
    // TODO:
    router.push(`/${username}/${slug}`);
  };

  return (
    <>
      <section>
        <h2>Enter CGS AutoUpdate Url</h2>
        <form onSubmit={submitAutoUpdateUrl}>
          <input
            value={autoUpdateUrl}
            onChange={(e) => setAutoUpdateUrl(e.target.value)}
            placeholder="https://www.cardgamesimulator.com/games/Standard/Standard.json"
          />
          <button type="submit" className="btn-green" disabled={!isValid}>
            Submit AutoUpdate Url to CGS Games
          </button>
        </form>
      </section>
      <SignOutButton />
    </>
  );
}

function SignOutButton() {
  return <button onClick={() => signOut()}>Sign Out</button>;
}
