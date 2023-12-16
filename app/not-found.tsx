import Footer from "@/components/footer";
import Header from "@/components/header";
import Link from "next/link";

export default function Page() {
  return (
    <main className="main-container">
      <Header title="CGS Games" />
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">Return Home</Link>
      <Footer />
    </main>
  );
}
