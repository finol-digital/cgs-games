import { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cgs.games"),
  title: {
    template: `%s | CGS Games`,
    default: "CGS Games",
  },
  description: "Share your CGS games",
  openGraph: {
    title: "CGS Games",
    description: "Share your CGS games",
    locale: "en_US",
    siteName: "CGS Games",
    type: "website",
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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.png"></link>
        <meta name="theme-color" content="#fff" />
      </head>
      <body>{children}</body>
    </html>
  );
}
