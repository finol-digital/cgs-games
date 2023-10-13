import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";
import Script from "next/script";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <>
      <canvas id="unity-canvas" width="960" height="600"></canvas>
      <Script src="/Unity/WebGL.loader.js" />
      <Script src="/UnityWebGL.js" />
    </>
  );
}
