import Footer from '@/components/footer';
import BrowseGames from '@/components/browseGames';
import { getAllGames } from '@/lib/firebase/firestore';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CGS Games Browser',
  description: 'Browse and search Card Game Simulator (CGS) games.',
  openGraph: {
    title: 'CGS Games Browser',
    description: 'Browse and search Card Game Simulator (CGS) games.',
  },
};

export default async function Page() {
  const allGames = await getAllGames();
  return (
    <>
      <main className="main-content">
        <h1 className="text-center text-4xl font-bold my-4">CGS Games Browser</h1>
        <BrowseGames games={allGames} />
      </main>
      <Footer />
    </>
  );
}
