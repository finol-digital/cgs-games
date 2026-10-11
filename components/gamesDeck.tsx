import Game from '@/lib/game';
import GameCard from '@/components/gameCard';

/** Lists games with a page-specific number of eager banners; longer lists stay lazy. */
export default function GamesDeck({
  games,
  canDelete = false,
  priorityCount = 1,
}: {
  games: Game[];
  canDelete?: boolean;
  priorityCount?: number;
}) {
  const isEmpty = games.length == 0;
  if (isEmpty) {
    return <p className="text-center">No games found.</p>;
  }
  return (
    <div className="mx-5 grid grid-cols-1 gap-5">
      {games.map((game, index) => {
        return (
          <GameCard
            game={game}
            key={game.id}
            canDelete={canDelete}
            priority={index < priorityCount}
          />
        );
      })}
    </div>
  );
}
