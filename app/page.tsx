import Footer from "@/components/footer";
import Header from "@/components/header";
import Link from "next/link";

export default function Page() {
  return (
    <main className="main-container">
      <Header title="CGS Games" />
      <div className="main-content">
        <p>
          Welcome to the{" "}
          <Link href="https://www.cardgamesimulator.com">
            Card Game Simulator
          </Link>{" "}
          (CGS) Games website!
        </p>
        <p>
          This website allows CGS users to share their games, and you can{" "}
          <Link href="/browse">browse CGS Games here</Link>.
        </p>
        <p>
          If you want to create your own game, you can refer to{" "}
          <Link href="https://github.com/finol-digital/Card-Game-Simulator/wiki/Crash-Course-into-Game-Development-with-CGS">
            The Crash Course into Game Development with CGS
          </Link>
          .
        </p>
        <p>
          Once you&apos;re ready to share your game, go to the{" "}
          <Link href="/upload">CGS Games Upload</Link>.
        </p>
      </div>
      <Footer />
    </main>
  );
}
