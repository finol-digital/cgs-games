import Banner from "@/components/banner";

export default function Header({
  home = "/",
  img = "/cgs.png",
  txt = "Share your Card Game Simulator (CGS) games",
  title,
}: {
  home?: string;
  img?: string;
  txt?: string;
  title?: string;
}) {
  return (
    <header>
      <center>
        <Banner home={home} img={img} txt={txt} />
      </center>
      <hr />
      {title && <h1>{title}</h1>}
    </header>
  );
}
