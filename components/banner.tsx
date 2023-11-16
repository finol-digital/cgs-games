import Link from "next/link";

export default function Banner({
  home = "/",
  img = "/cgs.png",
  txt = "Share your Card Game Simulator (CGS) games",
}: {
  home?: string;
  img?: string;
  txt?: string;
}) {
  return (
    <>
      <Link href={home}>
        <img
          // img instead of next/Image
          src={img}
          height="128"
          alt={txt}
          //priority={true}
        />
      </Link>
    </>
  );
}
