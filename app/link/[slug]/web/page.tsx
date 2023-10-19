import Footer from "@/components/footer";
import Header from "@/components/header";
import UnityWeb from "@/components/unityWeb";
import { getGame } from "@/lib/firebase/firestore";
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
      />
      <UnityWeb url={game.autoUpdateUrl} />
      <Footer linkToList={true} />
    </main>
  );
}
