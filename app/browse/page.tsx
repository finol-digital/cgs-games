import Footer from "@/components/footer";
import GamesTable from "@/components/gamesTable";
import Header from "@/components/header";
import { getAllGames } from "@/lib/firebase/firestore";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Games Browser",
  description: "Browse CGS games.",
  openGraph: {
    title: "CGS Games Browser",
    description: "Browse CGS games.",
  },
};

export default async function Page() {
  const allGames = await getAllGames();
  return (
    <main className="main-container">
      <Header title="CGS Games Browser" />
      <div className="main-content">
        <GamesTable games={allGames} />
        <p>
          If you would like to add your game, try the{" "}
          <Link href="/upload">CGS Games Upload</Link>.
        </p>
      </div>
      <Footer />
    </main>
  );
}
