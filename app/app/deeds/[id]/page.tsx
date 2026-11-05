import { notFound } from "next/navigation";

import { isPremiumTab, PremiumWorkspace } from "@/components/premium/workspace";
import { StandardWorkspace } from "@/components/standard/workspace";
import { isAiConfigured } from "@/lib/ai/claude";
import { parseDeedData } from "@/lib/schemas/deed-data";
import { getLibraryEntry } from "@/lib/templates/library.server";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { Deed } from "@/types/database";

// AI extraction of scanned papers and drafting long templates can take a while.
export const maxDuration = 300;

/** A deed opens in the workspace of its mode: Standard (guided page) or Premium (sectioned). */
export default async function DeedDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [deedResult, documentsResult] = await Promise.all([
    workspace.supabase.from("deeds").select("*").eq("id", id).eq("firm_id", workspace.firm.id).maybeSingle(),
    workspace.supabase.from("deed_documents").select("id, category, file_name, mime_type, size_bytes").eq("deed_id", id).eq("firm_id", workspace.firm.id).order("created_at", { ascending: false }),
  ]);

  if (deedResult.error || documentsResult.error) throw new Error("Could not load this workspace. Please retry.");
  if (!deedResult.data) notFound();

  const deed = deedResult.data as Deed;
  const initialData = parseDeedData(deed.data);
  const common = { aiEnabled: isAiConfigured(), deed, initialDocuments: documentsResult.data ?? [], firmCity: workspace.firm.city, firmName: workspace.firm.name, initialData };

  // Library-template documents are AI-written from a template, so they always use the Standard page.
  if (initialData.workspace.mode === "premium" && !initialData.custom) {
    const tab = typeof query.tab === "string" && isPremiumTab(query.tab) ? query.tab : undefined;
    return <PremiumWorkspace key="premium" {...common} firmId={workspace.firm.id} initialTab={tab} />;
  }
  return <StandardWorkspace key="standard" {...common} template={getLibraryEntry(initialData.custom?.templateId) ?? null} />;
}
