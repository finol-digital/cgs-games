import Footer from "@/components/footer";
import { getGame } from "@/lib/firebase/firestore";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata(props: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  return {
    title: game.name + " | CGS Games",
    description: "Play " + game.name + " on CGS",
    openGraph: {
      title: game.name + " | CGS Games",
      description: "Play " + game.name + " on CGS",
      images: [
        {
          url: game.bannerImageUrl,
        },
      ],
    },
  };
}

export default async function GameLayout(props: {
  children: React.ReactNode;
  params: Promise<{ username: string; slug: string }>;
}) {
  const { children } = props;
  const params = await props.params;
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  const copyrightNotice =
    game && game.name && game.copyright
      ? game.name +
        " is copyright/TM of " +
        game.copyright +
        "; CGS is unaffiliated"
      : params.username + " ©" + game.uploadedAt;
  return (
    <>
      {children}
      <Footer copyrightNotice={copyrightNotice} />
    </>
  );
}
