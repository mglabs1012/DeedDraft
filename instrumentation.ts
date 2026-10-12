import type { Instrumentation } from "next";

/**
 * Server start-up checks and structured error logs. Every uncaught server error
 * (page render, server action, route handler) is written as one JSON line that
 * log tools (Vercel, Datadog, CloudWatch…) can search by `digest` — the same
 * reference the user sees on the error page.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((name) => !process.env[name]?.trim());
  if (missing.length) console.warn(JSON.stringify({ level: "warn", msg: "missing environment variables", missing }));
  const aws = ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].filter((name) => !process.env[name]?.trim());
  if (aws.length > 0 && aws.length < 3) console.warn(JSON.stringify({ level: "warn", msg: "AI partly configured; AI features stay off", missing: aws }));
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      msg: "request failed",
      digest: err.digest ?? null,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      type: context.routeType,
      error: (err.message ?? String(error)).slice(0, 1000),
      stack: err.stack?.split("\n").slice(0, 6).join("\n") ?? null,
    }),
  );
};
