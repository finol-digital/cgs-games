import Footer from "@/components/footer";
import Header from "@/components/header";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <>
      <main className="main-container">
        <Header
          title={"CGS for " + game.name + " on Steam"}
          img={game.bannerImageUrl}
          txt={game.name}
          home={"/link/" + params.slug}
        />
        <h2>Install CGS</h2>
        <iframe
          src="https://store.steampowered.com/widget/1742850/"
          width="646"
          height="190"
        ></iframe>
        <h2>Import {game.name}</h2>
        <p>TODO: ADD INSTRUCTIONS</p>
      </main>
      <Footer linkToList={true} />
    </>
  );
}
