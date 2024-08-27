import Footer from "@/components/footer";
import GamesDeck from "@/components/gamesDeck";
import Header from "@/components/header";
import { getAllGames } from "@/lib/firebase/firestore";
import Link from "next/link";

export default async function Page() {
  const allGames = await getAllGames();
  return (
    <main className="main-container">
      <Header title="CGS Games" />
      <div className="main-content">
        <p>
          Welcome to the{" "}
          <Link href="https://www.cardgamesimulator.com">
            Card Game Simulator
          </Link>{" "}
          (CGS) Games website!
        </p>
        <p>
          You can{" "}
          <Link href="https://github.com/finol-digital/Card-Game-Simulator/wiki/Crash-Course-into-Game-Development-with-CGS">
            create
          </Link>{" "}
          and <Link href="/upload">upload</Link> your own custom card games, or
          browse games uploaded by others:
        </p>
        <GamesDeck games={allGames} />
      </div>
      <Footer />
    </main>
  );
}
