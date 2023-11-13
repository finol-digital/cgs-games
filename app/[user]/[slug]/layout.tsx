import { getGame } from "@/lib/firebase/firestore";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: { user: string; slug: string };
}): Promise<Metadata> {
  const game = (await getGame(params.user, params.slug))?.at(0);
  if (!game) return notFound();
  return {
    title: game.name,
    description: "Play " + game.name + " on CGS",
    openGraph: {
      title: game.name,
      description: "Play " + game.name + " on CGS",
      images: [
        {
          url: game.bannerImageUrl,
        },
      ],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
