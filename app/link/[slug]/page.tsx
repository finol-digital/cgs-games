import Banner from "@/components/banner";
import Footer from "@/components/footer";

export default function Page() {
  return (
    <main className="main-container">
      <Banner />
      <a href="https://apps.apple.com/us/app/card-game-simulator/id1392877362?itsct=apps_box_badge&amp;itscg=30200">
        <img
          src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&amp;releaseDate=1536624000"
          alt="Download on the App Store"
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
      <iframe
        src="https://store.steampowered.com/widget/1742850/"
        width="646"
        height="190"
      ></iframe>
      <Footer />
    </main>
  );
}
