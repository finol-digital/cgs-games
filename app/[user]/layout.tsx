import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { user: string };
}): Promise<Metadata> {
  return {
    title: params.user,
    description: params.user + "'s games",
    openGraph: {
      title: params.user,
      description: params.user + "'s games",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
