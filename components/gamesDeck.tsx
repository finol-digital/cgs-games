import Game from "@/lib/game";
import { Card, CardBody, CardFooter } from "@nextui-org/card";
import Link from "next/link";
import Banner from "./banner";

export default function GamesDeck({ games }: { games: Game[] }) {
  const isEmpty = games.length == 0;
  if (isEmpty) {
    return <h3 className="text-center">No games found.</h3>;
  }
  return (
    <div className="ml-5 mr-5 gap-2 grid grid-cols-1">
      {games.map((game, index) => {
        return (
          <Card
            key={index}
            className="border-none bg-slate-800 flex items-center"
          >
            <CardBody>
              <center>
                <Banner
                  home={`/${game.username}/${game.slug}`}
                  img={game.bannerImageUrl}
                  txt={game.name}
                />
              </center>
            </CardBody>
            <CardFooter className="justify-between text-small text-white">
              {game.copyright && (
                <p className="ml-4 mr-4">Copyright of {game.copyright}</p>
              )}
              <p className="ml-4 mr-4">
                Uploaded by{" "}
                <Link href={`/${game.username}`}>{game.username}</Link>
              </p>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
