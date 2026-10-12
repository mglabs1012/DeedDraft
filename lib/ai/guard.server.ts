import "server-only";

import { takeSlot } from "@/lib/ai/rate-window";
import type { requireWorkspace } from "@/lib/workspace";

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;

/**
 * AI usage limits, so a stuck button, a script or a shared login cannot run up
 * the Bedrock bill. Two layers:
 *   - per user, per minute: in memory on this server instance (bursts);
 *   - per firm, per day: counted from the activity log, where every AI call
 *     is recorded with an "ai_" action (shared by all server instances).
 * Limits are set with AI_LIMIT_PER_MINUTE and AI_LIMIT_PER_DAY (0 = off).
 */

const intEnv = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const aiLimits = () => ({ perMinute: intEnv("AI_LIMIT_PER_MINUTE", 20), perDay: intEnv("AI_LIMIT_PER_DAY", 500) });

const recent = new Map<string, number[]>();
const dayCache = new Map<string, { count: number; at: number }>();

async function firmCallsToday(workspace: Workspace) {
  const cached = dayCache.get(workspace.firm.id);
  // Re-count at most every 30 s, and always when close to the limit.
  if (cached && Date.now() - cached.at < 30_000 && cached.count < aiLimits().perDay - 25) {
    cached.count += 1;
    return cached.count;
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await workspace.supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", workspace.firm.id)
    .like("action", "ai\\_%")
    .gte("created_at", since);
  if (error) {
    // Never block work because the counter failed; the per-minute limit still applies.
    console.error(JSON.stringify({ level: "warn", msg: "ai quota count failed", code: error.code }));
    return 0;
  }
  dayCache.set(workspace.firm.id, { count: count ?? 0, at: Date.now() });
  return count ?? 0;
}

/** Returns a message for the user when the limit is reached, otherwise null (and counts the call). */
export async function aiAllowance(workspace: Workspace): Promise<string | null> {
  const { perMinute, perDay } = aiLimits();
  if (!takeSlot(recent, workspace.user.id, perMinute)) {
    return "You are using AI very quickly. Please wait a minute and try again.";
  }
  if (perDay > 0 && (await firmCallsToday(workspace)) >= perDay) {
    return "Your firm has reached today's AI limit (" + perDay + " requests in 24 hours). It resets gradually over the next day; ask your administrator to raise AI_LIMIT_PER_DAY if needed.";
  }
  return null;
}
