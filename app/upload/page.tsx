import Footer from "@/components/footer";
import Header from "@/components/header";
import UploadGameForm from "@/components/uploadGameForm";
import { Metadata } from "next";

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
      <UploadGameForm />
      <Footer />
    </main>
  );
}
