import Footer from "@/components/footer";
import Header from "@/components/header";
import Upload from "@/components/upload";
import { getAuthenticatedAppForUser } from "@/lib/firebase/firebase";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CGS Games Upload",
  description: "",
  openGraph: {
    title: "CGS Games Upload",
    description: "",
  },
};

export default async function Page() {
  const { currentUser } = await getAuthenticatedAppForUser();
  return (
    <main className="main-container">
      <Header title="CGS Games Upload" />
      <Upload initialUser={currentUser?.toJSON()} />
      <p>authentication, link to self, and upload functionality</p>
      <Footer />
    </main>
  );
}
