export default async function Banner() {
  return (
    <>
      <center>
        <img
          // img instead of next/Image
          src="/cgs.png"
          height="128"
          alt="Share your Card Game Simulator (CGS) games"
          //priority={true}
        />
      </center>
      <hr></hr>
    </>
  );
}
