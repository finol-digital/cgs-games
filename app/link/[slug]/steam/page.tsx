import Banner from "@/components/banner";
import Footer from "@/components/footer";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <main className="main-container">
      <Banner url={game.bannerImageUrl} />
      <h1>CGS for {game.name}</h1>
      <iframe
        src="https://store.steampowered.com/widget/1742850/"
        width="646"
        height="190"
      ></iframe>
      <Footer />
    </main>
  );
}
