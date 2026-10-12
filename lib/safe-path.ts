/** Only same-site app paths are followed after sign-in (no open redirects). */
export function safeNextPath(next: string | null | undefined) {
  return next && /^\/app(\/|$|\?)/.test(next) && !next.includes("//") && !next.includes("\\") ? next : "/app/dashboard";
}
