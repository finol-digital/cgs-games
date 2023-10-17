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
          title={"Play " + game.name}
          img={game.bannerImageUrl}
          txt={game.name}
          home={"/link/" + params.slug}
        />
        <p>
          To get started with playing {game.name}, select your preferred
          platform:
        </p>
        <form>
          <button formAction={"/link/" + params.slug + "/native"}>
            Launch native app (Android/iOS/macOS/Windows)
          </button>
        </form>
        <br />
        <form>
          <button formAction={"/link/" + params.slug + "/steam"}>
            Install on Steam (Windows/macOS/Linux)
          </button>
        </form>
        <br />
        <form>
          <button formAction={"/link/" + params.slug + "/web"}>
            View in web browser
          </button>
        </form>
      </main>
      <Footer linkToList={true} />
    </>
  );
}
