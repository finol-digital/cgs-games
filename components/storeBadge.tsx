"use client";

import Link from "next/link";

export default function StoreBadge() {
  const android = /Android/i.test(navigator?.userAgent);
  const ios = /iPhone|iPad|iPod/i.test(navigator?.userAgent);
  const mac = /Mac/i.test(navigator?.userAgent);
  const windows = /Windows/i.test(navigator?.userAgent);
  const unknown = !android && !ios && !mac && !windows;
  return (
    <>
      {(android || unknown) && (
        <Link
          target="_blank"
          href="https://play.google.com/store/apps/details?id=com.finoldigital.cardgamesim&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1"
        >
          <img
            // img instead of next/Image
            src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
            width="250"
            height="83"
            alt="Get it on Google Play"
          />
        </Link>
      )}
      {(ios || unknown) && (
        <Link
          target="_blank"
          href="https://apps.apple.com/us/app/card-game-simulator/id1392877362?itsct=apps_box_badge&amp;itscg=30200"
        >
          <img
            // img instead of next/Image
            src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&amp;releaseDate=1536624000"
            width="250"
            height="83"
            alt="Download on the App Store"
          />
        </Link>
      )}
      {(mac || unknown) && (
        <Link
          target="_blank"
          href="https://apps.apple.com/us/app/card-game-simulator/id1398206553"
        >
          <img
            // img instead of next/Image
            src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-mac-app-store.svg"
            width="250"
            height="83"
            alt="Download on the Mac App Store"
          />
        </Link>
      )}
      {(windows || unknown) && (
        <Link
          target="_blank"
          href="https://www.microsoft.com/en-us/p/card-game-simulator/9N96N5S4W3J0"
        >
          <img
            // img instead of next/Image
            src="https://get.microsoft.com/images/en-us%20dark.svg"
            width="250"
            height="83"
            alt="Get it from Microsoft"
          />
        </Link>
      )}
    </>
  );
}
