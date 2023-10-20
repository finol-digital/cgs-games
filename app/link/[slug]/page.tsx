import Footer from "@/components/footer";
import Header from "@/components/header";
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
        title={"Play " + game.name}
      />
      <p>To get started with playing {game.name}, choose your preference:</p>
      <br />
      <p>
        <Link href={"/link/" + params.slug + "/native"}>
          Launch native app (Android/iOS/macOS/Windows)
        </Link>
      </p>
      <br />
      <p>
        <Link href={"/link/" + params.slug + "/steam"}>
          Install on Steam (Windows/macOS/Linux)
        </Link>
      </p>
      <br />
      <p>
        <Link href={"/link/" + params.slug + "/web"}>
          View in web browser (NOT Recommended)
        </Link>
      </p>
      <Footer linkToList={true} />
    </main>
  );
}
