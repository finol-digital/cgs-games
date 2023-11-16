import Footer from "@/components/footer";
import Header from "@/components/header";
import { getAuthenticatedAppForUser } from "@/lib/firebase/firebase";
import { getAllGames } from "@/lib/firebase/firestore";
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
  const allGames = await getAllGames();
  return (
    <main className="main-container">
      <Header title="CGS Games Upload" />
      <p>authentication, link to self, and upload functionality</p>
      <Footer />
    </main>
  );
}
