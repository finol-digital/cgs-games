import Footer from "@/components/footer";
import Header from "@/components/header";
import UploadGameForm from "@/components/uploadGameForm";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CGS Games Upload",
  description: "Upload your CGS game.",
  openGraph: {
    title: "CGS Games Upload",
    description: "Upload your CGS game.",
  },
};

export default function Page() {
  return (
    <main className="main-container">
      <Header title="CGS Games Upload" />
      <p>This page is still in development!</p>
      <p>
        If you would like to have your game uploaded in the meantime, you can
        email{" "}
        <Link href="mailto:david@finoldigital.com">david@finoldigital.com</Link>
      </p>
      <UploadGameForm />
      <Footer />
    </main>
  );
}
