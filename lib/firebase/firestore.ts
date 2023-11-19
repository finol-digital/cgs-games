import { db } from "@/lib/firebase/firebase";
import {
  QueryDocumentSnapshot,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function getAllGames() {
  const results = await getDocs(query(collection(db, "games")));
  return results.docs.map((doc) => game(doc));
}

export async function getGames(username: string) {
  const usernameQuery = query(
    collection(db, "games"),
    where("username", "==", username),
  );
  const results = await getDocs(usernameQuery);
  return results.docs.map((doc) => game(doc));
}

export async function getGame(username: string, slug: string) {
  const usernameQuery = query(
    collection(db, "games"),
    where("username", "==", username),
  );
  const results = await getDocs(
    query(usernameQuery, where("slug", "==", slug)),
  );
  return results.docs.map((doc) => game(doc));
}

function game(doc: QueryDocumentSnapshot) {
  return {
    username: doc.get("username"),
    slug: doc.get("slug"),
    name: doc.get("name"),
    bannerImageUrl: doc.get("bannerImageUrl"),
    autoUpdateUrl: doc.get("autoUpdateUrl"),
    copyright: doc.get("copyright"),
  };
}
