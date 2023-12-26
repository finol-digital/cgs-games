import { db } from "@/lib/firebase/firebase";
import {
  QueryDocumentSnapshot,
  collection,
  doc,
  getDocs,
  limitToLast,
  orderBy,
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
    query(
      usernameQuery,
      where("slug", "==", slug),
      orderBy("uploadedAt"),
      limitToLast(1),
    ),
  );
  return results.docs.map((doc) => game(doc))?.at(0);
}

function game(doc: QueryDocumentSnapshot) {
  return {
    username: doc.get("username"),
    slug: doc.get("slug"),
    name: doc.get("name"),
    bannerImageUrl: doc.get("bannerImageUrl"),
    autoUpdateUrl: doc.get("autoUpdateUrl"),
    copyright: doc.get("copyright"),
    uploadedAt: doc.get("uploadedAt"),
  };
}

export function getUserDoc(uid: string) {
  return doc(db, "users", uid);
}
