"use client";

import { UserContext } from "@/lib/context";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { db } from "@/lib/firebase/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import debounce from "lodash.debounce";
import snakecase from "lodash.snakecase";
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
    if (
      val === "list" ||
      val === "upload" ||
      val === "terms" ||
      val === "privacy" ||
      val === "api"
    ) {
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

function isValidHttpsUrl(string: string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "https:";
}

function AutoUpdateUrlForm() {
  const router = useRouter();
  const { username } = useContext(UserContext);
  const [autoUpdateUrl, setAutoUpdateUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  let isValid = false;
  if (!loading) {
    const isValidUrl = isValidHttpsUrl(autoUpdateUrl);
    const inputError = isValidUrl ? "" : "Please input valid https url";
    if (error != inputError) setError(inputError);
    isValid = isValidUrl;
  }

  const submitAutoUpdateUrl = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError("");
    try {
      if (!username) {
        throw new Error("No username!");
      }
      setLoading(true);
      const response = await fetch(autoUpdateUrl);
      const cardGameDef: {
        name: string;
        bannerImageUrl: string;
        copyright: string;
      } = await response.json();
      const slug = encodeURI(snakecase(cardGameDef.name));
      const game = {
        username: username,
        slug: slug,
        name: cardGameDef.name,
        bannerImageUrl: cardGameDef.bannerImageUrl,
        autoUpdateUrl: autoUpdateUrl,
        copyright: cardGameDef.copyright ? cardGameDef.copyright : username,
        uploadedAt: serverTimestamp(),
      };
      console.log(game);
      await addDoc(collection(db, "games"), game);
      setLoading(false);
      router.push(`/${username}/${slug}`);
    } catch (err: any) {
      setLoading(false);
      setError(err);
    }
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
          <br />
          {error && <p className="text-danger">{error}</p>}
          {!error && <p />}
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
