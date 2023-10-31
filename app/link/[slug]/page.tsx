import CgsDeepLink from "@/components/cgsDeepLink";
import FooterForGame from "@/components/footerForGame";
import Header from "@/components/header";
import { getGame } from "@/lib/firebase/firestore";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <main className="main-container">
      <Header
        home={"/link/" + params.slug}
        img={game.bannerImageUrl}
        txt={game.name}
        title={"Play " + game.name}
      />
      <h2>Launch the CGS app to play {game.name}:</h2>
      <CgsDeepLink game={game} />
      <h2>Alternatively:</h2>
      <ul>
        <li>
          <Link href={"/link/" + params.slug + "/steam"}>
            Install on Steam (Windows/macOS/Linux)
          </Link>
        </li>
        <li>
          <Link href={"/link/" + params.slug + "/web"}>
            Play in web browser
          </Link>
        </li>
      </ul>
      <FooterForGame game={game} />
    </main>
  );
}
