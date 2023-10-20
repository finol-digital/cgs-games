import Footer from "@/components/footer";
import Header from "@/components/header";
import UnityWeb from "@/components/unityWeb";
import { getGame } from "@/lib/firebase/firestore";
import Link from "next/link";
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
      <p>
        NOTE: This page is experimental. Instead of using this page, please{" "}
        <Link href={"/link/" + params.slug + "/native"}>Launch native app</Link>
      </p>
      <UnityWeb url={game.autoUpdateUrl} />
      <Footer linkToList={true} />
    </main>
  );
}
