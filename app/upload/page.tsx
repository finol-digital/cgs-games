import Footer from "@/components/footer";
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
    <>
      <main className="main-content">
        <h1 className="text-center">CGS Games Upload</h1>
        <p className="ml-10 mr-10">
          To create your own game in CGS, refer to{" "}
          <Link
            href="https://github.com/finol-digital/Card-Game-Simulator/wiki/Crash-Course-into-Game-Development-with-CGS"
            target="_blank"
          >
            The Crash Course into Game Development with CGS
          </Link>
          .
        </p>
        <p>
          Once you have your CGS AutoUpdate Url, you can sign in and upload:
        </p>
        <UploadGameForm />
      </main>
      <Footer />
    </>
  );
}
