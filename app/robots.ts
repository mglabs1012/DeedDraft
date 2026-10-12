import type { MetadataRoute } from "next";

/** The workspace is private: keep search engines out of signed-in pages and APIs. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/login", "/signup"], disallow: ["/app", "/api", "/auth", "/onboarding"] }] };
}
