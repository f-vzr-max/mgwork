import type { MetadataRoute } from "next";
import { env } from "@/lib/config";

// Public, indexable routes only. Authenticated areas are excluded (see robots).
const ROUTES = [
  "",
  "/candidats",
  "/entreprises",
  "/tarifs",
  "/conformite",
  "/contact",
  "/aide",
  "/guides/candidat",
  "/guides/entreprise",
  "/legal/mentions-legales",
  "/legal/confidentialite",
  "/legal/conditions",
  "/legal/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.appUrl().replace(/\/$/, "");
  return ROUTES.map((r) => ({
    url: `${base}${r || "/"}`,
    changeFrequency: "weekly",
    priority: r === "" ? 1 : 0.7,
  }));
}
