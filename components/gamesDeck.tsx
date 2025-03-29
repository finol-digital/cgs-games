import Game from '@/lib/game';
import GameCard from './gameCard';

export default function GamesDeck({
  games,
  canDelete = false,
}: {
  games: Game[];
  canDelete?: boolean;
}) {
  const isEmpty = games.length == 0;
  if (isEmpty) {
    return <h3 className="text-center">No games found.</h3>;
  }
  return (
    <div className="ml-5 mr-5 gap-2 grid grid-cols-1">
      {games.map((game) => {
        return <GameCard game={game} key={game.id} canDelete={canDelete} />;
      })}
    </div>
  );
}
