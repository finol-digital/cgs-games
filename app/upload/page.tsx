import Footer from "@/components/footer";
import Header from "@/components/header";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Games Upload",
  description: "Upload your CGS game.",
  openGraph: {
    title: "CGS Games Upload",
    description: "Upload your CGS game.",
  },
};

export default async function Page() {
  return (
    <main className="main-container">
      <Header title="CGS Games Upload" />
      <p>
        The user upload functionality is still under construction! In the
        meantime, if you would like to add your game to the list, please email{" "}
        <Link href="mailto:david@finoldigital.com">david@finoldigital.com</Link>
      </p>
      <Footer />
    </main>
  );
}
