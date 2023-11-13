import FooterForGame from "@/components/footerForGame";
import Header from "@/components/header";
import UnityWeb from "@/components/unityWeb";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { user: string; slug: string };
}) {
  const game = (await getGame(params.user, params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <main className="main-container">
      <Header
        home={"/link/" + params.slug}
        img={game.bannerImageUrl}
        txt={game.name}
      />
      <UnityWeb url={game.autoUpdateUrl} name={game.name} />
      <FooterForGame game={game} />
    </main>
  );
}
