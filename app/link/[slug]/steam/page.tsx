import Banner from "@/components/banner";
import Footer from "@/components/footer";
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
      <h1>CGS for {game.name}</h1>
      <h2>Install CGS</h2>
      <iframe
        src="https://store.steampowered.com/widget/1742850/"
        width="646"
        height="190"
      ></iframe>
      <h2>Download {game.name}</h2>
      <p>TODO: ADD INSTRUCTIONS</p>
      <Footer />
    </main>
  );
}
