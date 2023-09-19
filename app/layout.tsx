import { Metadata } from "next";
import Image from "next/image";
import cgsPic from "../public/cgs.png";

export const metadata: Metadata = {
  title: {
    template: `%s | CGS Games`,
    default: "CGS Games",
  },
  description: "Share your CGS games",
  openGraph: {
    title: "CGS Games",
    description: "Share your CGS games",
    locale: "en_US",
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
      <body>
        <center>
          <Image
            src={cgsPic}
            height="200"
            alt="Share your Card Game Simulator (CGS) games"
            priority={true}
          />
        </center>
        <hr></hr>
        {children}
      </body>
    </html>
  );
}
