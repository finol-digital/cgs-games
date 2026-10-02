import Game from '@/lib/game';
import GameCard from './gameCard';

/** Lists games in a single column and gives only the first banner eager loading priority. */
export default function GamesDeck({
  games,
  canDelete = false,
}: {
  games: Game[];
  canDelete?: boolean;
}) {
  const isEmpty = games.length == 0;
  if (isEmpty) {
    return <p className="text-center">No games found.</p>;
  }
  return (
    <div className="ml-5 mr-5 gap-2 grid grid-cols-1">
      {games.map((game, index) => {
        return <GameCard game={game} key={game.id} canDelete={canDelete} priority={index === 0} />;
      })}
    </div>
  );
}
