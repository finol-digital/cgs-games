import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://cgs.games",
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: "https://cgs.games/list",
      lastModified: new Date(),
      priority: 2,
    },
    {
      url: "https://cgs.games/upload",
      lastModified: new Date(),
      priority: 3,
    },
  ];
}
