import "server-only";

import { parseDeedData } from "@/lib/schemas/deed-data";
import type { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";
import { userMessage } from "@/lib/errors";

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>;

/**
 * Saves one key of deeds.data atomically through update_deed_section
 * (migration 202610100005 allows the AI sections). On databases where that migration
 * has not run yet, falls back to read-modify-write of the whole data object.
 */
export async function saveDeedSection(workspace: Workspace, deedId: string, section: "custom" | "localized" | "aiDraft" | "chat", value: unknown): Promise<string | null> {
  const { error } = await workspace.supabase.rpc("update_deed_section", { p_deed_id: deedId, p_section: section, p_value: value as Json });
  if (!error) return null;
  const fallback = error.code === "PGRST202" || error.code === "42883" || /unknown deed section/i.test(error.message);
  if (!fallback) return userMessage(error);

  const { data: deed, error: readError } = await workspace.supabase.from("deeds").select("data").eq("id", deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (readError || !deed) return readError?.message ?? "Deed not found.";
  const { error: writeError } = await workspace.supabase
    .from("deeds")
    .update({ data: { ...parseDeedData(deed.data), [section]: value } as unknown as Json })
    .eq("id", deedId);
  return writeError?.message ?? null;
}
