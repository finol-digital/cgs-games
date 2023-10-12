import { db } from "@/lib/firebase/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export async function getGamesList() {
  const results = await getDocs(query(collection(db, "games")));
  return results.docs.map((doc) => {
    return {
      slug: doc.get("slug"),
      name: doc.get("name"),
    };
  });
}

export async function getGame(slug: string) {
  const results = await getDocs(
    query(query(collection(db, "games"), where("slug", "==", slug))),
  );
  return results.docs.map((doc) => {
    return {
      slug: doc.get("slug"),
      name: doc.get("name"),
      bannerImageUrl: doc.get("bannerImageUrl"),
      autoUpdateUrl: doc.get("autoUpdateUrl"),
    };
  });
}
