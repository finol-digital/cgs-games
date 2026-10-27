import Footer from '@/components/footer';
import BrowseGames from '@/components/browseGames';
import { adminGetAllGames } from '@/lib/firebase/admin';
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

interface BrowsePageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/** Loads the public catalog and initializes Browse from the first URL search query. */
export default async function Page({ searchParams }: BrowsePageProps) {
  const [allGames, params] = await Promise.all([adminGetAllGames(), searchParams]);
  const initialQuery = (Array.isArray(params.q) ? params.q[0] : params.q) || '';
  return (
    <>
      <main className="main-content">
        <h1 className="text-center text-4xl font-bold my-4">CGS Games Browser</h1>
        <BrowseGames key={initialQuery} games={allGames} initialQuery={initialQuery} />
      </main>
      <Footer />
    </>
  );
}
