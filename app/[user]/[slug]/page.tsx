import CgsDeepLink from "@/components/cgsDeepLink";
import { getGame } from "@/lib/firebase/firestore";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { user: string; slug: string };
}) {
  const game = (await getGame(params.user, params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <>
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
    </>
  );
}
