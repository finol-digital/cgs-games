import AlternativeAccordion from "@/components/alternativeAccordion";
import CgsDeepLink from "@/components/cgsDeepLink";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { username: string; slug: string };
}) {
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  const cgsgg = "https://cgs.gg/?url=" + encodeURIComponent(game.autoUpdateUrl);
  return (
    <section className="main-content">
      <h2>Launch the CGS app to play {game.name}:</h2>
      <CgsDeepLink game={game} />
      <h2>Alternatively:</h2>
      <AlternativeAccordion game={game} cgsgg={cgsgg} />
    </section>
  );
}
