import Game from "@/lib/game";
import Link from "next/link";

export default function GamesTable({ games }: { games: Game[] }) {
  return (
    <>
      <table>
        <caption>CGS Games Table</caption>
        <thead>
          <tr>
            <th align="left">Game</th>
            <th align="left">Copyright</th>
            <th align="left">Uploaded By</th>
          </tr>
        </thead>
        <tbody>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
