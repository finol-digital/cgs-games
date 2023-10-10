import Link from "next/link";

interface Game {
  slug: string;
  name: string;
}

export default function GamesList({ games }: { games: Game[] }) {
  return (
    <ul>
      {games
        .sort((a: Game, b: Game) => a.name.localeCompare(b.name))
        .map((game: Game) => (
          <li key={game.slug}>
            <Link href={"/link/" + game.slug}>{game.name}</Link>
          </li>
        ))}
    </ul>
  );
}
