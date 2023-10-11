export default function Banner({ url = "/cgs.png" }: { url?: string }) {
  return (
    <>
      <center>
        <img
          // img instead of next/Image
          src={url}
          height="128"
          alt="Share your Card Game Simulator (CGS) games"
          //priority={true}
        />
      </center>
      <hr></hr>
    </>
  );
}
