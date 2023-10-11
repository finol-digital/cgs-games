import Banner from "@/components/banner";
import Footer from "@/components/footer";
import Link from "next/link";

export default async function Page() {
  return (
    <main className="main-container">
      <Banner />
      <h1>Card Game Simulator (CGS) Games</h1>
      <p>Welcome to the CGS Games website [under construction]!</p>
      <p>Soon, you will be able to upload your own games to this website.</p>
      <p>
        The user upload functionality is still in development, but you can get
        started in the meantime with the official{" "}
        <Link href="/link">Games List</Link>.
      </p>
      <Footer />
    </main>
  );
}
