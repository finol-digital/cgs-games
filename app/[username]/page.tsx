import Footer from "@/components/footer";
import GamesDeck from "@/components/gamesDeck";
import Header from "@/components/header";
import { getGames } from "@/lib/firebase/firestore";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  return {
    title: params.username,
    description: params.username + "'s games",
    openGraph: {
      title: params.username,
      description: params.username + "'s games",
    },
  };
}

export default async function Page({
  params,
}: {
  params: { username: string };
}) {
  const games = await getGames(params.username);
  if (!games) return notFound();
  return (
    <main className="main-container">
      <Header title={params.username + "'s games"} />
      <div className="main-content">
        <GamesDeck games={games} />
      </div>
      <Footer />
    </main>
  );
}
