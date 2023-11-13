import Footer from "@/components/footer";
import GamesList from "@/components/gamesList";
import Header from "@/components/header";
import { getAllGames } from "@/lib/firebase/firestore";
import Link from "next/link";

export default async function Page() {
  const allGames = await getAllGames();
  return (
    <main className="main-container">
      <Header title="CGS Games" />
      <p>
        Welcome to the{" "}
        <Link href="https://www.cardgamesimulator.com">
          Card Game Simulator
        </Link>{" "}
        (CGS) Games website!
      </p>
      <p>Soon, you will be able to upload your own games to this website.</p>
      <p>
        The user upload functionality is still in development, but you can get
        started in the meantime by selecting a game from this list:
      </p>
      <GamesList games={allGames} />
      <p>
        If you would like to add your game to the list, please email{" "}
        <Link href="mailto:david@finoldigital.com">david@finoldigital.com</Link>
      </p>
      <Footer />
    </main>
  );
}
