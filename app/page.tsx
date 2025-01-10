import Footer from '@/components/footer';
import GamesDeck from '@/components/gamesDeck';
import { getGames } from '@/lib/firebase/firestore';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const allGames = await getGames(2);
  return (
    <>
      <main className="main-content">
        <h1 className="text-center">CGS Games</h1>
        <p className="text-center">
          Welcome to the{' '}
          <Link href="https://www.cardgamesimulator.com" target="_blank">
            Card Game Simulator
          </Link>{' '}
          (CGS) Games website!
        </p>
        <p className="text-center">
          You can{' '}
          <Link
            href="https://github.com/finol-digital/Card-Game-Simulator/wiki/Crash-Course-into-Game-Development-with-CGS"
            target="_blank"
          >
            create
          </Link>{' '}
          and <Link href="/upload">upload</Link> your own custom card games, or{' '}
          <Link href="/browse">browse</Link> games uploaded by others:
        </p>
        <GamesDeck games={allGames} />
        <p className="text-center">
          <Link href="/browse">Browse All Games</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
