export default async function Banner() {
  return (
    <>
      <center>
        <img
          // img src instead of next/Image ref
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
