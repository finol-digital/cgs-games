import Footer from "@/components/footer";
import Header from "@/components/header";
import StoreBadge from "@/components/storeBadge";
import { getGame } from "@/lib/firebase/firestore";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <>
      <main className="main-container">
        <Header
          title={"CGS for " + game.name}
          img={game.bannerImageUrl}
          txt={game.name}
          home={"/link/" + params.slug}
        />
        <h2>Install CGS</h2>
        <StoreBadge />
        <h2>Launch CGS for {game.name}</h2>
        <p>
          <Link
            href={
              "cardgamesim://link?url=" + encodeURIComponent(game.autoUpdateUrl)
            }
          >
            Click this link to launch CGS for {game.name}
          </Link>
        </p>
      </main>
      <Footer linkToList={true} />
    </>
  );
}
