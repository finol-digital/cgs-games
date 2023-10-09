import Image from "next/image";
import cgsPic from "public/cgs.png";

export default async function Banner() {
  return (
    <>
      <center>
        <Image
          src={cgsPic}
          height="128"
          alt="Share your Card Game Simulator (CGS) games"
          priority={true}
        />
      </center>
      <hr></hr>
    </>
  );
}
