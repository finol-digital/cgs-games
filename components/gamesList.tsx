import Link from "next/link";

export default function GamesList({ games }: { games: Game[] }) {
  return (
    <ul>
      {games
        .sort((a: Game, b: Game) => a.name.localeCompare(b.name))
        .map((game: Game) => (
          <li key={game.slug}>
            <Link href={`/${game.username}/${game.slug}`}>{game.name}</Link>
          </li>
        ))}
    </ul>
  );
}
