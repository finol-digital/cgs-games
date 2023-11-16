import Footer from "@/components/footer";
import GamesList from "@/components/gamesList";
import HeaderWithAuth from "@/components/headerWithAuth";
import { getAuthenticatedAppForUser } from "@/lib/firebase/firebase";
import { getAllGames } from "@/lib/firebase/firestore";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { currentUser } = await getAuthenticatedAppForUser();
  const allGames = await getAllGames();
  return (
    <main className="main-container">
      <HeaderWithAuth initialUser={currentUser?.toJSON()} title="CGS Games" />
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
