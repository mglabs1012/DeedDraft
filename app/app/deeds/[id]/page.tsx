import { notFound } from "next/navigation";

import { StandardWorkspace } from "@/components/standard/workspace";
import { isAiConfigured } from "@/lib/ai/claude";
import { parseDeedData } from "@/lib/schemas/deed-data";
import { getLibraryEntry } from "@/lib/templates/library.server";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { Deed } from "@/types/database";

// AI extraction of scanned papers and drafting long templates can take a while.
export const maxDuration = 300;

export default async function DeedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [deedResult, documentsResult] = await Promise.all([
    workspace.supabase.from("deeds").select("*").eq("id", id).eq("firm_id", workspace.firm.id).maybeSingle(),
    workspace.supabase.from("deed_documents").select("id, category, file_name, mime_type, size_bytes").eq("deed_id", id).eq("firm_id", workspace.firm.id).order("created_at", { ascending: false }),
  ]);

  if (deedResult.error || documentsResult.error) throw new Error("Could not load this workspace. Please retry.");
  if (!deedResult.data) notFound();

  const initialData = parseDeedData(deedResult.data.data);
  const entry = getLibraryEntry(initialData.custom?.templateId);

  return (
    <StandardWorkspace
      aiEnabled={isAiConfigured()}
      deed={deedResult.data as Deed}
      initialDocuments={documentsResult.data ?? []}
      firmCity={workspace.firm.city}
      firmName={workspace.firm.name}
      initialData={initialData}
      template={entry ?? null}
    />
  );
}
