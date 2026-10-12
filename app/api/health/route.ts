import { NextResponse } from "next/server";

import { isAiConfigured } from "@/lib/ai/claude";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * Uptime / deployment check: GET /api/health.
 * Reports whether the database is reachable and AI is configured. No secrets,
 * no user data. Returns 503 when the database cannot be reached.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "unreachable" | "not_configured" = "not_configured";
  if (isSupabaseConfigured()) {
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/health", {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      database = response.ok ? "ok" : "unreachable";
    } catch {
      database = "unreachable";
    }
  }
  const healthy = database === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", database, ai: isAiConfigured() ? "configured" : "off", latencyMs: Date.now() - started, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
