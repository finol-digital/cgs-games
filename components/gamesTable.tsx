import Game from "@/lib/game";
import Link from "next/link";

export default function GamesTable({ games }: { games: Game[] }) {
  return (
    <>
      <table>
        <tr>
          <th align="left">Game</th>
          <th align="left">Copyright</th>
          <th align="left">Upload User</th>
          <th align="left">Upload Date</th>
        </tr>
        {games.map((val, key) => {
          return (
            <tr key={key}>
              <td>
                <Link href={`/${val.username}/${val.slug}`}>{val.name}</Link>
              </td>
              <td>{val.copyright}</td>
              <td>
                <Link href={`/${val.username}`}>{val.username}</Link>
              </td>
              <td>{val.uploadedAt.toDate().toLocaleDateString()}</td>
            </tr>
          );
        })}
      </table>
    </>
  );
}
