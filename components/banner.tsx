export default function Banner({
  url = "/cgs.png",
  txt = "Share your Card Game Simulator (CGS) games",
}: {
  url?: string;
  txt?: string;
}) {
  return (
    <>
      <center>
        <img
          // img instead of next/Image
          src={url}
          height="128"
          alt={txt}
          //priority={true}
        />
      </center>
      <hr></hr>
    </>
  );
}
