import Game from "@/lib/game";
import { Card, CardBody, CardFooter, CardHeader } from "@nextui-org/card";
import Link from "next/link";
import Banner from "./banner";

export default function GamesDeck({ games }: { games: Game[] }) {
  return (
    <div className="max-w-[800px] gap-2 grid grid-cols-1">
      {games.map((game, index) => {
        return (
          <Card key={index} className="border-none bg-slate-400">
            <CardBody className="overflow-visible p-0">
              <center>
                <Banner
                  home={`/${game.username}/${game.slug}`}
                  img={game.bannerImageUrl}
                  txt={game.name}
                />
              </center>
            </CardBody>
            <CardFooter className="justify-between text-small text-gray-800">
              {game.copyright && <p>Copyright of {game.copyright}</p>}
              <p>
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
