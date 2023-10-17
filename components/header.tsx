import Banner from "@/components/banner";

export default function Header({
  title,
  img = "/cgs.png",
  txt = "Share your Card Game Simulator (CGS) games",
  home = "/",
}: {
  title: string;
  img?: string;
  txt?: string;
  home?: string;
}) {
  return (
    <header>
      <Banner img={img} txt={txt} home={home} />
      <hr />
      <h1>{title}</h1>
    </header>
  );
}
