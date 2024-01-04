import Game from "@/lib/game";
import Link from "next/link";

export default function GamesTable({ games }: { games: Game[] }) {
  return (
    <>
      <table>
        <tr>
          <th>Game</th>
          <th>Username</th>
          <th>Uploaded At</th>
        </tr>
        {games
          .sort((a: Game, b: Game) => a.name.localeCompare(b.name))
          .map((val, key) => {
            return (
              <tr key={key}>
                <td>
                  <Link href={`/${val.username}/${val.slug}`}>{val.name}</Link>
                </td>
                <td>
                  <Link href={`/${val.username}`}>{val.username}</Link>
                </td>
                <td>{val.uploadedAt.toDate().toDateString()}</td>
              </tr>
            );
          })}
      </table>
    </>
  );
}
