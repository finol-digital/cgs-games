import Footer from "components/footer";
import Image from "next/image";
import cgsPic from "public/cgs.png";

export default function Page() {
  return (
    <div className="main-container">
      <center>
        <Image
          src={cgsPic}
          height="128"
          alt="Share your Card Game Simulator (CGS) games"
          priority={true}
        />
      </center>
      <hr></hr>
      <h1>Card Game Simulator (CGS) Games Link</h1>
      <p>Add download links here</p>
      <Footer />
    </div>
  );
}
