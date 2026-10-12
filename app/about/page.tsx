import Link from 'next/link';
import InformationPage from '@/components/informationPage';
import { publicPageMetadata } from '@/lib/siteIdentity';

export const metadata = publicPageMetadata(
  'About CGS Games | Card Game Simulator Community',
  'Learn about the CGS Games community library, its creators, and its operator Finol Digital LLC.',
  '/about',
);

export default function AboutPage() {
  return (
    <InformationPage title="About CGS Games">
      <p>
        CGS Games is a community library for Card Game Simulator, operated by Finol Digital LLC.
        Players can discover custom card games, visit creator collections, and follow play links to
        open games in Card Game Simulator. The library connects people who make card games with
        people who want to explore and play them.
      </p>
      <h2>Created and shared by the community</h2>
      <p>
        You can <Link href="/browse">browse the game library</Link> without signing in. To publish a
        game, sign in, choose a creator username, and <Link href="/upload">upload</Link> an
        auto-update URL or a .cgs.zip archive. Game pages identify their creators and copyright
        owners. Sharing a game here does not transfer ownership of its artwork, rules, or other
        content.
      </p>
      <h2>For players, creators, and developers</h2>
      <p>
        Learn about the simulator at{' '}
        <Link href="https://www.cardgamesimulator.com">Card Game Simulator</Link>. Developers and
        agents can read the public catalog through the API described in our{' '}
        <Link href="/developers">developer portal</Link>. For support or questions about a listing,
        visit <Link href="/contact">Contact</Link>. Our <Link href="/terms">Terms</Link> and{' '}
        <Link href="/privacy">Privacy Policy</Link> explain how the service handles content and
        information.
      </p>
    </InformationPage>
  );
}
