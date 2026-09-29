"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { editableDraftSchema } from "@/lib/drafting/editable";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

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
  const { data: deed } = await workspace.supabase.from("deeds").select("id").eq("id", parsed.data.deedId).eq("firm_id", workspace.firm.id).maybeSingle();
  if (!deed) return { error: "Deed not found." };

  const { data: latest, error: readError } = await workspace.supabase
    .from("deed_drafts")
    .select("version")
    .eq("deed_id", deed.id)
    .eq("language", parsed.data.draft.language)
    .order("version", { ascending: false })
    .limit(1);
  if (readError) return { error: readError.code === "42P01" ? "Draft versions need database migration 0004. Ask your administrator to run it." : readError.message };

  const version = (latest?.[0]?.version ?? 0) + 1;
  const { data, error } = await workspace.supabase
    .from("deed_drafts")
    .insert({ deed_id: deed.id, firm_id: workspace.firm.id, language: parsed.data.draft.language, version, content: parsed.data.draft as unknown as Json, note: parsed.data.note || null, created_by: workspace.user.id })
    .select("id, language, version, note, created_at, content")
    .single();
  if (error || !data) return { error: error?.code === "23505" ? "Someone saved a newer version at the same time. Reload and try again." : error?.message ?? "Could not save the draft." };

  await workspace.supabase.from("activity_log").insert({ firm_id: workspace.firm.id, deed_id: deed.id, user_id: workspace.user.id, action: "saved_draft_version", details: { language: data.language, version } });
  revalidatePath("/app/deeds/" + deed.id);
  return { draft: data as SavedDraft };
}
