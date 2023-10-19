import Footer from "@/components/footer";
import GamesList from "@/components/gamesList";
import Header from "@/components/header";
import { getGamesList } from "@/lib/firebase/firestore";
import Link from "next/link";

export const metadata = {
  title: "CGS Games List",
  description: "List of all CGS games.",
};

export default async function Page() {
  const gamesList = await getGamesList();
  return (
    <>
      <main className="main-container">
        <Header title="CGS Games List" />
        <p>Get started by selecting a game from the list:</p>
        <GamesList games={gamesList} />
        <p>
          If you would like to add your game to the list, please email{" "}
          <Link href="mailto:david@finoldigital.com">
            david@finoldigital.com
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
