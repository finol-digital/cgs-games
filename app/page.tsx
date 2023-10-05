import Footer from "components/footer";
import GamesList from "components/gamesList";
import Image from "next/image";
import Link from "next/link";
import cgsPic from "public/cgs.png";

export default function Page() {
  return (
    <div className="main-container">
      <center>
        <Image
          src={cgsPic}
          height="128"
          alt="Share your Card Game Simulator (CGS) games"
          priority={true}
        />
      </center>
      <hr></hr>
      <h1>Welcome to cgs.games!</h1>
      <p>Get started by selecting a game from the list of games:</p>
      <GamesList />
      <p>
        If you would like to add your game to the list of games, email{" "}
        <Link href="mailto:david@finoldigital.com">david@finoldigital.com</Link>
      </p>
      <Footer />
    </div>
  );
}
