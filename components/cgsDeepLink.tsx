import StoreBadge from '@/components/storeBadge';
import Game from '@/lib/game';

export default function CgsDeepLink({ game }: { game: Game }) {
  return (
    <ol className="list-decimal list-inside my-2 ml-2">
      <li>
        First install CGS from the appropriate store:
        <StoreBadge />
      </li>
      <li>
        Then launch CGS for {game.name}:<br />
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
