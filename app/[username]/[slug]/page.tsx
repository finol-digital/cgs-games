import AlternativeAccordion from '@/components/alternativeAccordion';
import Banner from '@/components/banner';
import { getGame } from '@/lib/firebase/firestore';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function Page(props: { params: Promise<{ username: string; slug: string }> }) {
  const params = await props.params;
  const game = await getGame(params.username, params.slug);
  if (!game) return notFound();
  const cgsgg = 'https://cgs.gg/main?url=' + encodeURIComponent(game.autoUpdateUrl);
  return (
    <>
      <Banner home={cgsgg} img={game.bannerImageUrl} txt={game.name} />
      <main className="main-content flex flex-col items-center">
        <Link
          href={cgsgg}
          target="_blank"
          className="inline-block rounded-lg bg-[#4B2E19] border-2 border-yellow-400 px-8 py-4 text-lg font-bold text-yellow-300 shadow-lg transition hover:bg-[#6B3F23] hover:text-yellow-200 focus:outline-none focus:ring-4 focus:ring-yellow-400/40"
          style={{ boxShadow: '0 4px 16px 0 rgba(75, 46, 25, 0.18)' }}
        >
          Play {game.name} Now
        </Link>
        <h2 className="text-xl font-semibold mt-8 mb-2 my-4 text-center">Alternatively:</h2>
        <AlternativeAccordion game={game} />
      </main>
    </>
  );
}
