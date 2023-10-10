import { db } from "@/lib/firebase/firebase";
import { collection, getDocs, query } from "firebase/firestore";

export async function getGamesList() {
  const results = await getDocs(query(collection(db, "games")));
  return results.docs.map((doc) => {
    return {
      slug: doc.get("slug"),
      name: doc.get("name"),
    };
  });
}
