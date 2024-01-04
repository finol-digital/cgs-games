import { getAllGames } from "@/lib/firebase/firestore";

export async function GET() {
  const allGames = await getAllGames();
  return new Response(JSON.stringify(allGames));
}
