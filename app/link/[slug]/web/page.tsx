import Banner from "@/components/banner";
import Footer from "@/components/footer";
import UnityWeb from "@/components/unityWeb";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <main className="main-container">
      <Banner
        img={game.bannerImageUrl}
        txt={game.name}
        home={"/link/" + params.slug}
      />
      <UnityWeb url={game.autoUpdateUrl} />
      <Footer />
    </main>
  );
}
