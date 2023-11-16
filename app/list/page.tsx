import Footer from "@/components/footer";
import GamesList from "@/components/gamesList";
import Header from "@/components/header";
import { getAllGames } from "@/lib/firebase/firestore";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Games List",
  description: "",
  openGraph: {
    title: "CGS Games List",
    description: "",
  },
};

export default async function Page() {
  const allGames = await getAllGames();
  return (
    <main className="main-container">
      <Header title="CGS Games List" />
      <p>Here are all the games available:</p>
      <GamesList games={allGames} />
      <p>
        If you would like to add your game to the list, please email{" "}
        <Link href="mailto:david@finoldigital.com">david@finoldigital.com</Link>
      </p>
      <Footer />
    </main>
  );
}
