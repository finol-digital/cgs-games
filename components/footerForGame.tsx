import Footer from "@/components/footer";
import Game from "@/lib/game";

export default function FooterForGame({ game }: { game: Game }) {
  if (game.copyright) {
    const disclaimer =
      game.name +
      " is copyright/TM of " +
      game.copyright +
      "; CGS is unaffiliated";
    return <Footer disclaimer={disclaimer} />;
  }
  return <Footer />;
}
