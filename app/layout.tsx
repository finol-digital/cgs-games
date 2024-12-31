import Header from "@/components/header";
import UserContextProvider from "@/components/userContextProvider";
import { Metadata, Viewport } from "next";
import "./global.css";
import { Providers } from "./providers";

const APP_NAME = "CGS Games";
const APP_DESCRIPTION = "Share your CGS games";

export const metadata: Metadata = {
  metadataBase: new URL("https://cgs.games"),
  applicationName: APP_NAME,
  title: APP_NAME,
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    locale: "en_US",
  },
  robots: {
    follow: true,
    index: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#D3BD7A",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="dark">
        <div className="main-container">
          <Providers>
            <UserContextProvider>
              <Header />
              {children}
            </UserContextProvider>
          </Providers>
        </div>
      </body>
    </html>
  );
}
