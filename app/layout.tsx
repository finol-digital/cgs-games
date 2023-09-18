import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: `%s | CGS Games`,
    default: 'CGS Games',
  },
  description: 'Share your CGS games',
  openGraph: {
    title: 'CGS Games',
    description: 'Share your CGS games',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    follow: true,
    index: true
  },
}

export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    )
  }