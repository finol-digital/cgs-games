import type { Metadata } from 'next';

export const siteDescription =
  'CGS Games is the Card Game Simulator card game community. Browse, play, create, and share custom card games, and integrate with the public game catalog API.';

// Contact details already published in the site's Terms and Privacy pages.
export const organization = {
  '@type': 'Organization',
  '@id': 'https://cgs.games/#organization',
  name: 'Finol Digital LLC',
  url: 'https://finoldigital.com',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'david@finoldigital.com',
    contactType: 'customer support',
    url: 'https://cgs.games/contact',
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: '17350 State Hwy 249, Ste 220',
    addressLocality: 'Houston',
    addressRegion: 'TX',
    postalCode: '77064',
    addressCountry: 'US',
  },
};

export const homepageStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    organization,
    {
      '@type': 'WebSite',
      '@id': 'https://cgs.games/#website',
      name: 'CGS Games',
      description: siteDescription,
      url: 'https://cgs.games/',
      inLanguage: 'en',
      publisher: { '@id': organization['@id'] },
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://cgs.games/#application',
      name: 'CGS Games',
      description: siteDescription,
      url: 'https://cgs.games/',
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web browser',
      publisher: { '@id': organization['@id'] },
    },
  ],
};

/** Give each public resource its own canonical URL and share metadata. */
export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website',
      siteName: 'CGS Games',
      images: [{ url: '/opengraph-image.png', alt: 'CGS Games' }],
    },
  };
}
