import type { MetadataRoute } from "next";

const SITE_URL = "https://useatomic.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/app", "/actions", "/how-it-works", "/markets", "/risks"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/app" || path === "/markets" ? "hourly" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
