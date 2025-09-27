import AlternativeAccordion from '@/components/alternativeAccordion';
import Banner from '@/components/banner';
import CgsDeepLink from '@/components/cgsDeepLink';
import { getGame } from '@/lib/firebase/firestore';
import { notFound } from 'next/navigation';

export default async function Page(props: { params: Promise<{ username: string; slug: string }> }) {
  const params = await props.params;
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  const cgsgg = 'https://cgs.gg/?url=' + encodeURIComponent(game.autoUpdateUrl);
  return (
    <>
      <Banner
        home={`/` + params.username + `/` + params.slug}
        img={game.bannerImageUrl}
        txt={game.name}
      />
      <main className="main-content">
        <h2 className="text-2xl font-bold mb-2 my-4">Launch the CGS app to play {game.name}:</h2>
        <CgsDeepLink game={game} />
        <h2 className="text-xl font-semibold mt-8 mb-2 my-4">Alternatively:</h2>
        <AlternativeAccordion game={game} cgsgg={cgsgg} />
      </main>
    </>
  );
}
