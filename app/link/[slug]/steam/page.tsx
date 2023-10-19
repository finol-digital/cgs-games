import AutoUpdateUrl from "@/components/autoUpdateUrl";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { getGame } from "@/lib/firebase/firestore";
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
        title={"CGS for " + game.name + " on Steam"}
      />
      <h2>Install CGS</h2>
      <iframe
        src="https://store.steampowered.com/widget/1742850/"
        width="646"
        height="190"
      ></iframe>
      <h2>Import {game.name}</h2>
      <AutoUpdateUrl url={game.autoUpdateUrl} />
      <ol>
        <li>Copy the above AutoUpdateUrl</li>
        <li>Use Steam to launch CGS and go to the Main Menu</li>
        <li>
          Open the Games Management Menu by tapping on the card in the center
        </li>
        <li>
          Click the Import button and select &quot;Download from Web&quot;
        </li>
        <li>Paste the AutoUpdateUrl and submit</li>
      </ol>
      <Footer linkToList={true} />
    </main>
  );
}
