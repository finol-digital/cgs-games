import { Metadata } from "next";
import "./global.css";

const APP_NAME = "CGS Games";
const APP_DEFAULT_TITLE = "CGS Games";
const APP_TITLE_TEMPLATE = "%s | CGS Games";
const APP_DESCRIPTION = "Share your CGS games";

export const metadata: Metadata = {
  metadataBase: new URL("https://cgs.games"),
  applicationName: APP_NAME,
  title: {
    template: APP_TITLE_TEMPLATE,
    default: APP_DEFAULT_TITLE,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  themeColor: "#FFFFFF",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      template: APP_TITLE_TEMPLATE,
      default: APP_DEFAULT_TITLE,
    },
    description: APP_DESCRIPTION,
    locale: "en_US",
  },
  robots: {
    follow: true,
    index: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
