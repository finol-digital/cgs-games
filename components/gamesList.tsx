import Link from "next/link";

export default function GamesList({ games }: { games: any }) {
  return (
    <ul>
      {games
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
        .map((game: any) => (
          <li key={game.slug}>
            <Link href={"/link/" + game.slug}>{game.name}</Link>
          </li>
        ))}
    </ul>
  );
}
