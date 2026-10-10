import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Template library text is read from disk by server code; include it in the server build.
  outputFileTracingIncludes: { "/app/**": ["./data/template-library/**", "./data/reference-drafts.json"] },
  experimental: {
    // Reference drafts (PDF/Word up to 20 MB) are sent straight to a server action.
    serverActions: { bodySizeLimit: "21mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
