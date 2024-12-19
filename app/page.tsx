import Footer from "@/components/footer";
import GamesDeck from "@/components/gamesDeck";
import { getAllGames } from "@/lib/firebase/firestore";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Page() {
  const allGames = await getAllGames();
  return (
    <>
      <main className="main-content">
        <h1 className="text-center">CGS Games</h1>
        <p className="text-center">
          Welcome to the{" "}
          <Link href="https://www.cardgamesimulator.com" target="_blank">
            Card Game Simulator
          </Link>{" "}
          (CGS) Games website!
        </p>
        <p className="text-center">
          You can{" "}
          <Link
            href="https://github.com/finol-digital/Card-Game-Simulator/wiki/Crash-Course-into-Game-Development-with-CGS"
            target="_blank"
          >
            create
          </Link>{" "}
          and <Link href="/upload">upload</Link> your own custom card games, or
          browse games uploaded by others:
        </p>
        <GamesDeck games={allGames} />
      </main>
      <Footer />
    </>
  );
}
