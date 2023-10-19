import Footer from "@/components/footer";
import Header from "@/components/header";
import Link from "next/link";

export default function Page() {
  return (
    <>
      <main className="main-container">
        <Header title="CGS Games" />
        <p>Welcome to the Card Game Simulator (CGS) Games website!</p>
        <p>Soon, you will be able to upload your own games to this website.</p>
        <p>
          The user upload functionality is still in development, but you can get
          started in the meantime with the official{" "}
          <Link href="/link">CGS Games List</Link>.
        </p>
      </main>
      <Footer />
    </>
  );
}
