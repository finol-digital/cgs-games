import Footer from '@/components/footer';
import GamesDeck from '@/components/gamesDeck';
import { getGamesFor } from '@/lib/firebase/firestore';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

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

export default async function Page(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const games = await getGamesFor(params.username);
  if (!games) return notFound();
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
