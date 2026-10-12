import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** The Supabase project (REST, storage uploads, signed preview URLs, realtime). */
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();
const supabaseSocket = supabase.replace(/^http/, "ws");

/**
 * Content-Security-Policy: scripts, frames and connections only from this site
 * and the firm's Supabase project. Inline scripts/styles are needed by Next.js
 * and by the draft preview (srcdoc) and print window; dev adds eval + HMR sockets.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + supabase,
  "font-src 'self' data:",
  "connect-src 'self' " + supabase + " " + supabaseSocket + (isDev ? " ws: wss:" : ""),
  "frame-src 'self' blob: " + supabase,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
    return [
      { source: "/:path*", headers: securityHeaders },
      // Signed-in pages and API responses are private: never cache them in shared caches.
      { source: "/app/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
