import { db } from "@/lib/firebase/firebase";
import {
  Query,
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
  const gamesQuery = query(collection(db, "games"));
  const results = await getLatestDocs(gamesQuery, 50);
  return results.docs.map((doc) => game(doc));
}

export async function getGames(username: string) {
  const gamesUsernameQuery = query(
    collection(db, "games"),
    where("username", "==", username),
  );
  const results = await getLatestDocs(gamesUsernameQuery, 50);
  return results.docs.map((doc) => game(doc));
}

export async function getGame(username: string, slug: string) {
  const gamesUsernameQuery = query(
    collection(db, "games"),
    where("username", "==", username),
  );
  const results = await getDocs(
    query(
      gamesUsernameQuery,
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

async function getLatestDocs(unfilteredQuery: Query, count: number) {
  return getDocs(
    query(unfilteredQuery, orderBy("uploadedAt"), limitToLast(count)),
  );
}

export function userDoc(uid: string) {
  return doc(db, "users", uid);
}
