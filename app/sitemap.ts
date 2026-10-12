import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...['developers', 'about', 'contact'].map((path) => ({
      url: `https://cgs.games/${path}`,
      priority: path === 'developers' ? 0.8 : 0.6,
    })),
    {
      url: 'https://cgs.games',
      lastModified: new Date(),
      priority: 1.0,
    },
    {
      url: 'https://cgs.games/browse',
      lastModified: new Date(),
      priority: 0.9,
    },
    {
      url: 'https://cgs.games/upload',
      lastModified: new Date(),
      priority: 0.8,
    },
    {
      url: 'https://cgs.games/terms',
      lastModified: new Date(),
      priority: 0.7,
    },
    {
      url: 'https://cgs.games/privacy',
      lastModified: new Date(),
      priority: 0.6,
    },
  ];
}
