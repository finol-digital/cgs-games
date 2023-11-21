import UnityWeb from "@/components/unityWeb";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { username: string; slug: string };
}) {
  const game = (await getGame(params.username, params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <>
      <UnityWeb url={game.autoUpdateUrl} name={game.name} />
    </>
  );
}
