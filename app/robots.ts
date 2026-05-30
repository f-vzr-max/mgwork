import type { MetadataRoute } from "next";
import { env } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const base = env.appUrl().replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated / non-content areas are not for indexing.
        disallow: [
          "/admin",
          "/api",
          "/candidate",
          "/enterprise",
          "/staff",
          "/onboarding",
          "/dashboard",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
