import Footer from "@/components/footer";
import GamesList from "@/components/gamesList";
import Header from "@/components/header";
import { getAllGames } from "@/lib/firebase/firestore";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Games List",
  description: "List of all CGS games.",
  openGraph: {
    title: "CGS Games List",
    description: "List of all CGS games.",
  },
};

export default async function Page() {
  const allGames = await getAllGames();
  return (
    <main className="main-container">
      <Header title="CGS Games List" />
      <p>Here is the list of all games:</p>
      <GamesList games={allGames} />
      <p>
        If you would like to add your game to this list, try the{" "}
        <Link href="/upload">CGS Games Upload</Link>.
      </p>
      <Footer />
    </main>
  );
}
