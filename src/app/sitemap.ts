import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/seo";
import { techniques } from "./meditation/data";
import { therapies } from "./therapies/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { path: "/", priority: 1 },
    { path: "/medication", priority: 0.7 },
    { path: "/ai", priority: 0.8 },
    { path: "/meditation", priority: 0.8 },
    { path: "/therapies", priority: 0.8 },
    { path: "/therapist", priority: 0.8 },
    { path: "/resources", priority: 0.6 },
    { path: "/emergency", priority: 0.6 },
    { path: "/brand", priority: 0.3 },
  ].map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    priority,
  }));

  const techniqueRoutes = techniques.map((technique) => ({
    url: `${SITE_URL}/meditation/${technique.slug}`,
    lastModified: new Date(),
    priority: 0.6,
  }));

  const therapyRoutes = therapies.map((therapy) => ({
    url: `${SITE_URL}/therapies/${therapy.slug}`,
    lastModified: new Date(),
    priority: 0.6,
  }));

  return [...staticRoutes, ...techniqueRoutes, ...therapyRoutes];
}
