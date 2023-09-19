import Image from "next/image";
import cgsPic from "../public/cgs.png";

export default function Page() {
  return (
    <>
      <center>
        <Image
          src={cgsPic}
          height="192"
          alt="Share your Card Game Simulator (CGS) games"
          priority={true}
        />
      </center>
      <hr></hr>
      <h1>Welcome to cgs.games (under construction)!</h1>
    </>
  );
}
