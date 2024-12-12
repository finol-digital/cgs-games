import Footer from "@/components/footer";
import GamesDeck from "@/components/gamesDeck";
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
    <>
      <main className="main-content">
        <h1 className="text-center">CGS Games Browser</h1>
        <GamesDeck games={allGames} />
        <p>
          If you would like to add your game, try the{" "}
          <Link href="/upload">CGS Games Upload</Link>.
        </p>
      </main>
      <Footer />
    </>
  );
}
