import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'CGS Games',
    template: `%s | CGS Games`
  },
  description: 'Share your CGS games',
  openGraph: {
    title: 'CGS Games',
    description: 'Share your CGS games',
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