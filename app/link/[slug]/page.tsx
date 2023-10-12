import Banner from "@/components/banner";
import Footer from "@/components/footer";
import { getGame } from "@/lib/firebase/firestore";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <main className="main-container">
      <Banner url={game.bannerImageUrl} />
      <h1>Play {game.name}</h1>
      <p>
        To get started with playing {game.name}, select your preferred platform:
      </p>
      <ul>
        <li>
          <Link href={"/link/" + params.slug + "/web"}>
            Preview in web browser
          </Link>
        </li>
        <li>
          <Link href={"/link/" + params.slug + "/native"}>
            Launch native app (Android/iOS/macOS/Windows)
          </Link>
        </li>
        <li>
          <Link href={"/link/" + params.slug + "/steam"}>
            Use Steam (Windows/Linux/macOS)
          </Link>
        </li>
      </ul>
      <Footer />
    </main>
  );
}
