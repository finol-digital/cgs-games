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

export async function getGames(user: string) {
  const userQuery = query(collection(db, "games"), where("user", "==", user));
  const results = await getDocs(userQuery);
  return results.docs.map((doc) => game(doc));
}

export async function getGame(user: string, slug: string) {
  const userQuery = query(collection(db, "games"), where("user", "==", user));
  const results = await getDocs(query(userQuery, where("slug", "==", slug)));
  return results.docs.map((doc) => game(doc));
}

function game(doc: QueryDocumentSnapshot) {
  return {
    user: doc.get("user"),
    slug: doc.get("slug"),
    name: doc.get("name"),
    bannerImageUrl: doc.get("bannerImageUrl"),
    autoUpdateUrl: doc.get("autoUpdateUrl"),
    copyright: doc.get("copyright"),
  };
}
