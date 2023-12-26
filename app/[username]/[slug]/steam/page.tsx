import AutoUpdateUrl from "@/components/autoUpdateUrl";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { username: string; slug: string };
}) {
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  return (
    <>
      <h2>1. Install CGS</h2>
      <iframe
        src="https://store.steampowered.com/widget/1742850/"
        width="646"
        height="190"
      ></iframe>
      <h2>2. Import {game.name}</h2>
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
        <li>Paste the AutoUpdateUrl and Submit Download</li>
      </ol>
    </>
  );
}
