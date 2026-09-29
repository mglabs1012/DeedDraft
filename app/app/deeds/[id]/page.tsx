import { notFound } from "next/navigation";

import type { SavedDraft } from "@/app/actions/drafts";
import { DeedDetail } from "@/components/deeds/deed-detail";
import { isAiConfigured } from "@/lib/ai/openrouter";
import { parseDeedData } from "@/lib/schemas/deed-data";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { Database, Deed } from "@/types/database";

type Document = Database["public"]["Tables"]["deed_documents"]["Row"];
type Activity = Database["public"]["Tables"]["activity_log"]["Row"];

// AI extraction of scanned papers can take a while.
export const maxDuration = 120;

export default async function DeedDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [deedResult, documentsResult, activityResult, draftsResult] = await Promise.all([
    workspace.supabase.from("deeds").select("*").eq("id", id).eq("firm_id", workspace.firm.id).maybeSingle(),
    workspace.supabase.from("deed_documents").select("*").eq("deed_id", id).eq("firm_id", workspace.firm.id).order("created_at", { ascending: false }),
    workspace.supabase.from("activity_log").select("*").eq("deed_id", id).eq("firm_id", workspace.firm.id).order("created_at", { ascending: false }).limit(30),
    // Tolerates a database without migration 0004: the studio then starts from the generated draft.
    workspace.supabase.from("deed_drafts").select("id, language, version, note, created_at, content").eq("deed_id", id).eq("firm_id", workspace.firm.id).order("version", { ascending: false }).limit(20),
  ]);

  if (!deedResult.data) notFound();

  return (
    <DeedDetail
      aiEnabled={isAiConfigured()}
      activities={(activityResult.data ?? []) as Activity[]}
      deed={deedResult.data as Deed}
      documents={(documentsResult.data ?? []) as Document[]}
      firmCity={workspace.firm.city}
      firmId={workspace.firm.id}
      firmName={workspace.firm.name}
      initialData={parseDeedData(deedResult.data.data)}
      initialDrafts={draftsResult.error ? [] : ((draftsResult.data ?? []) as SavedDraft[])}
      initialTab={typeof query.tab === "string" ? query.tab : undefined}
    />
  );
}
