import Link from "next/link";

export default function Banner({
  img = "/cgs.png",
  txt = "Share your Card Game Simulator (CGS) games",
  home = "/",
}: {
  img?: string;
  txt?: string;
  home?: string;
}) {
  return (
    <>
      <center>
        <Link href={home}>
          <img
            // img instead of next/Image
            src={img}
            height="128"
            alt={txt}
            //priority={true}
          />
        </Link>
      </center>
      <hr></hr>
    </>
  );
}
