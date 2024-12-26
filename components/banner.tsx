import Link from "next/link";

export default function Banner({
  home = "/",
  img = "/Card-Game-Simulator.png",
  txt = "Card Game Simulator",
}: {
  home?: string;
  img?: string;
  txt?: string;
}) {
  return (
    <div className="border-none bg-slate-400 flex justify-center">
      <Link href={home} className="mt-8 mb-8 flex justify-center">
        <img
          // Can't use next/Image for external image
          className="flex justify-center"
          src={img}
          height="128"
          alt={txt}
          //priority={true}
        />
      </Link>
    </div>
  );
}
