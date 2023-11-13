import Footer from "@/components/footer";
import GamesList from "@/components/gamesList";
import Header from "@/components/header";
import { getGames } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { user: string } }) {
  const games = await getGames(params.user);
  if (!games) return notFound();
  return (
    <main className="main-container">
      <Header title={params.user + "'s games"} />
      <p>{params.user} has these games:</p>
      <GamesList games={games} />
      <Footer />
    </main>
  );
}
