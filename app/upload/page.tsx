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
      <div className="main-content">
        <p>
          If you want to create your own game, you can refer to{" "}
          <Link href="https://github.com/finol-digital/Card-Game-Simulator/wiki/Crash-Course-into-Game-Development-with-CGS">
            The Crash Course into Game Development with CGS
          </Link>
          .
        </p>
        <p>
          After you have set up your CGS AutoUpdate Url, you can sign in and
          upload:
        </p>
        <UploadGameForm />
      </div>
      <Footer />
    </main>
  );
}
