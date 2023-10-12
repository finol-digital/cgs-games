import Banner from "@/components/banner";
import Footer from "@/components/footer";
import { getGame } from "@/lib/firebase/firestore";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: { slug: string } }) {
  const game = (await getGame(params.slug))?.at(0);
  if (!game) return notFound();
  return (
    <main className="main-container">
      <Banner url={game.bannerImageUrl} />
      <h1>CGS for {game.name}</h1>
      <a href="https://apps.apple.com/us/app/card-game-simulator/id1392877362?itsct=apps_box_badge&amp;itscg=30200">
        <img
          src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&amp;releaseDate=1536624000"
          alt="Download on the App Store"
        />
      </a>
      <a href="https://apps.apple.com/us/app/card-game-simulator/id1398206553">
        <img
          src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-mac-app-store.svg"
          alt="Download on the Mac App Store"
        />
      </a>
      <a href="https://play.google.com/store/apps/details?id=com.finoldigital.cardgamesim&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1">
        <img
          src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
          alt="Get it on Google Play"
        />
      </a>
      <a href="https://www.microsoft.com/en-us/p/card-game-simulator/9N96N5S4W3J0">
        <img
          src="https://get.microsoft.com/images/en-us%20dark.svg"
          alt="Get it from Microsoft"
        />
      </a>
      <Footer />
    </main>
  );
}
