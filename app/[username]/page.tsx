import Footer from '@/components/footer';
import GamesDeck from '@/components/gamesDeck';
import { adminCreatorExists, adminGetGamesFor } from '@/lib/firebase/admin';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Describes a creator collection in page and social metadata. */
export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  return {
    title: params.username + ' | CGS Games',
    description: params.username + "'s games",
    openGraph: {
      title: params.username,
      description: params.username + "'s games",
    },
  };
}

/** Lists a creator's games, preserving empty profiles while rejecting unknown creators. */
export default async function Page(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const games = await adminGetGamesFor(params.username);
  if (games.length === 0 && !(await adminCreatorExists(params.username))) return notFound();
  return (
    <>
      <main className="main-content">
        <h1 className="text-center text-4xl font-bold my-4">{params.username}&apos;s games</h1>
        <GamesDeck games={games} canDelete={true} />
      </main>
      <Footer copyrightNotice={`${params.username}`} />
    </>
  );
}
