import Footer from "@/components/footer";
import Header from "@/components/header";
import Link from "next/link";

export default async function Page() {
  return (
    <main className="main-container">
      <Header title="CGS Games" />
      <p>
        Welcome to the{" "}
        <Link href="https://www.cardgamesimulator.com">
          Card Game Simulator
        </Link>{" "}
        (CGS) Games website!
      </p>
      <p>1. List, 2. Wiki to create, 3. Upload</p>
      <Footer />
    </main>
  );
}
