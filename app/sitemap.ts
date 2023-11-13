import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://cgs.games",
      lastModified: new Date(),
      priority: 1,
    },
  ];
}
