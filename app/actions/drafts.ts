"use server";

import { z } from "zod";

import { editableDraftSchema } from "@/lib/drafting/editable";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";
import { logActivity } from "@/lib/activity.server";

/** `content` is null for older versions in a list; their text is loaded when chosen (loadDraftVersion). */
export type SavedDraft = { id: string; language: "hindi" | "english"; version: number; note: string | null; created_at: string; content: unknown };

const saveSchema = z.object({
  deedId: z.string().uuid(),
  draft: editableDraftSchema,
  note: z.string().trim().max(300).optional(),
});

/** Saves an edited draft as the next immutable version for its language. */
export async function saveDraftVersion(input: unknown): Promise<{ error?: string; draft?: SavedDraft }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "The draft could not be saved (invalid content)." };
  const workspace = await requireWorkspace();
  const { deedId, draft, note } = parsed.data;
  const newest = () => workspace.supabase.from("deed_drafts").select("version").eq("deed_id", deedId).eq("firm_id", workspace.firm.id).eq("language", draft.language).order("version", { ascending: false }).limit(1);
  // The deed check and the latest version number are read together.
  const [{ data: deed }, { data: latest, error: readError }] = await Promise.all([
    workspace.supabase.from("deeds").select("id").eq("id", deedId).eq("firm_id", workspace.firm.id).maybeSingle(),
    newest(),
  ]);
  if (!deed) return { error: "Deed not found." };
  if (readError) return { error: readError.code === "42P01" ? "Draft versions need database migration 0004. Ask your administrator to run it." : readError.message };

  let version = (latest?.[0]?.version ?? 0) + 1;
  let data: Omit<SavedDraft, "content"> | null = null;
  for (let attempt = 0; attempt < 3 && !data; attempt += 1) {
    const saved = await workspace.supabase
      .from("deed_drafts")
      .insert({ deed_id: deed.id, firm_id: workspace.firm.id, language: draft.language, version, content: draft as unknown as Json, note: note || null, created_by: workspace.user.id })
      .select("id, language, version, note, created_at")
      .single();
    if (saved.data) { data = saved.data; break; }
    // Another save took this version number at the same moment: take the next one.
    if (saved.error?.code !== "23505") return { error: saved.error?.message ?? "Could not save the draft." };
    const { data: again } = await newest();
    version = Math.max(version, again?.[0]?.version ?? 0) + 1;
  }
  if (!data) return { error: "Someone saved a newer version at the same time. Try again." };

  logActivity(workspace, { deed_id: deed.id, action: "saved_draft_version", details: { language: data.language, version: data.version } });
  // The text is what was just sent; it is not read back from the database.
  return { draft: { ...data, content: draft } };
}
