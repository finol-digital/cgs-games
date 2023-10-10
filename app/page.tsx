import Banner from "@/components/banner";
import Footer from "@/components/footer";
import GamesList from "@/components/gamesList";
import { getGamesList } from "@/lib/firebase/firestore";
import Link from "next/link";

export default async function Page() {
  const gamesList = await getGamesList();
  return (
    <main className="main-container">
      <Banner />
      <h1>Card Game Simulator (CGS) Games List</h1>
      <p>Get started by selecting a game from the list:</p>
      <GamesList games={gamesList} />
      <p>
        If you would like to add your game to the list, please email{" "}
        <Link href="mailto:david@finoldigital.com">david@finoldigital.com</Link>
      </p>
      <Footer />
    </main>
  );
}
