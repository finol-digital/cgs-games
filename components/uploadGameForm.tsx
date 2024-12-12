"use client";

import { UserContext } from "@/lib/context";
import { db } from "@/lib/firebase/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import snakecase from "lodash.snakecase";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import SignInButton from "./signInButton";
import UsernameForm from "./usernameForm";

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
      const isValidUrl = isValidHttpsUrl(game.bannerImageUrl);
      if (!isValidUrl) {
        throw new Error("Invalid bannerImageUrl!");
      }
      await addDoc(collection(db, "games"), game);
      setLoading(false);
      router.push(`/${username}/${slug}`);
    } catch (err: any) {
      setLoading(false);
      setError(err);
    }
  };

  return (
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
  );
}
