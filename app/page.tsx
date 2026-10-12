import Footer from '@/components/footer';
import GamesDeck from '@/components/gamesDeck';
import { adminGetGames } from '@/lib/firebase/admin';
import Link from 'next/link';
import { homepageParagraphs } from '@/lib/siteContent';
import { homepageStructuredData, publicPageMetadata, siteDescription } from '@/lib/siteIdentity';

export const metadata = publicPageMetadata(
  'CGS Games | Card Game Simulator Card Game Community',
  siteDescription,
  '/',
);

export const dynamic = 'force-dynamic';

/** Loads the two latest games for the homepage and links to browsing and uploading. */
export default async function Page() {
  const latestGames = await adminGetGames(2);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageStructuredData).replace(/</g, '\\u003c'),
        }}
      />
      <main className="main-content">
        <h1 className="text-center text-4xl font-bold my-4">CGS Games</h1>
        <p className="text-center my-2">
          Welcome to the <Link href="https://www.cardgamesimulator.com">Card Game Simulator</Link>{' '}
          (CGS) Games website!
        </p>
        <p className="text-center my-2">
          You can{' '}
          <Link
            href="https://github.com/finol-digital/Card-Game-Simulator/wiki/Crash-Course-into-Game-Development-with-CGS"
            target="_blank"
          >
            create
          </Link>{' '}
          and{' '}
          <Link href="/upload" prefetch={false}>
            upload
          </Link>{' '}
          your own custom card games, or <Link href="/browse">browse</Link> games uploaded by
          others:
        </p>
        <GamesDeck games={latestGames} priorityCount={2} />
        <p className="text-center my-4">
          <Link href="/browse">Browse All Games</Link>
        </p>
        <section className="mx-auto my-6 max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold my-4">
            Your Card Game Simulator card game community
          </h2>
          {homepageParagraphs.map((paragraph) => (
            <p key={paragraph} className="my-3">
              {paragraph}
            </p>
          ))}
          <p className="my-3">
            Building a catalog integration or helping a player find a game? Visit the{' '}
            <Link href="/developers">CGS Games developer portal and API documentation</Link> for
            examples, authentication, and a sandbox, or read the{' '}
            <Link href="/llms.txt">agent guide</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
