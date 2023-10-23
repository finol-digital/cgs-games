import Footer from "@/components/footer";

export default function FooterForGame({ game }: { game: Game }) {
  if (game.copyright) {
    const disclaimer =
      game.name +
      " is trademark/copyright of " +
      game.copyright +
      "; CGS is unaffiliated";
    return <Footer disclaimer={disclaimer} />;
  }
  return <Footer />;
}
