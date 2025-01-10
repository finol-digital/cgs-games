import StoreBadge from '@/components/storeBadge';
import Game from '@/lib/game';

export default function CgsDeepLink({ game }: { game: Game }) {
  return (
    <ol>
      <li>
        <p>First install CGS from the appropriate store:</p>
        <StoreBadge />
      </li>
      <li>
        <p>Then launch CGS for {game.name}:</p>
        <a
          className="button"
          href={'cardgamesim://link?url=' + encodeURIComponent(game.autoUpdateUrl)}
          aria-label={'Launch CGS for ' + game.name}
        >
          <span>Launch CGS for {game.name}</span>
        </a>
      </li>
    </ol>
  );
}
