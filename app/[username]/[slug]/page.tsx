import AlternativeAccordion from '@/components/alternativeAccordion';
import Banner from '@/components/banner';
import GameShareActions from '@/components/gameShareActions';
import { adminGetGame } from '@/lib/firebase/admin';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/** Loads a game and its play options, prioritizing its banner or returning a missing-page response. */
export default async function Page(props: { params: Promise<{ username: string; slug: string }> }) {
  const params = await props.params;
  const game = await adminGetGame(params.username, params.slug);
  if (!game) return notFound();
  const cgsgg = 'https://cgs.gg/main?url=' + encodeURIComponent(game.autoUpdateUrl);
  return (
    <>
      <Banner home={cgsgg} img={game.bannerImageUrl} txt={game.name} priority />
      <main className="main-content flex flex-col items-center">
        {game.visibility === 'private' && (
          <p className="mb-6 flex items-center gap-2 text-center text-sm text-slate-300">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            This game is private: it isn&apos;t listed on CGS Games, but anyone with the link can
            open it.
          </p>
        )}
        <Link
          href={cgsgg}
          target="_blank"
          className="inline-block rounded-lg bg-[#4B2E19] border-2 border-yellow-400 px-8 py-4 text-lg font-bold text-yellow-300 shadow-lg transition hover:bg-[#6B3F23] hover:text-yellow-200 focus:outline-none focus:ring-4 focus:ring-yellow-400/40"
          style={{ boxShadow: '0 4px 16px 0 rgba(75, 46, 25, 0.18)' }}
        >
          Play {game.name} Now
        </Link>
        <GameShareActions gameId={game.id} owner={game.username} visibility={game.visibility} />
        <h2 className="text-xl font-semibold mt-8 mb-2 text-center">Alternatively:</h2>
        <AlternativeAccordion game={game} />
      </main>
    </>
  );
}
