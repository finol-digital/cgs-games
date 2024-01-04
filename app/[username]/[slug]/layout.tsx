import FooterForGame from "@/components/footerForGame";
import Header from "@/components/header";
import { getGame } from "@/lib/firebase/firestore";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: { username: string; slug: string };
}): Promise<Metadata> {
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  return {
    title: game.name + " | CGS Games",
    description: "Play " + game.name + " on CGS",
    openGraph: {
      title: game.name + " | CGS Games",
      description: "Play " + game.name + " on CGS",
      images: [
        {
          url: game.bannerImageUrl,
        },
      ],
    },
  };
}

export default async function GameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { username: string; slug: string };
}) {
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  return (
    <main className="main-container">
      <Header
        home={`/${game.username}/${game.slug}`}
        img={game.bannerImageUrl}
        txt={game.name}
        title={"Play " + game.name}
      />
      <section className="main-content">{children}</section>
      <FooterForGame game={game} />
    </main>
  );
}
