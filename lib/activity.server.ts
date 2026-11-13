import "server-only";
import { after } from "next/server";

import type { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;

/**
 * Records an activity entry after the response is sent, so saving, uploading
 * and drafting never wait for the audit log. Failures are logged, not shown.
 */
export function logActivity(workspace: Workspace, entry: { action: string; deed_id?: string | null; details?: Json }) {
  const row = { firm_id: workspace.firm.id, user_id: workspace.user.id, deed_id: entry.deed_id ?? null, action: entry.action, details: entry.details ?? {} };
  const write = async () => {
    const { error } = await workspace.supabase.from("activity_log").insert(row);
    if (error) console.error("Activity log entry not saved:", entry.action, error.message);
  };
  // Outside a request (scripts, tests) there is nothing to wait for: write straight away.
  try { after(write); } catch { void write().catch(() => undefined); }
}
