import { notFound } from "next/navigation";

import { DeedDetail } from "@/components/deeds/deed-detail";
import { parseDeedData } from "@/lib/schemas/deed-data";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { Database, Deed } from "@/types/database";

type Document = Database["public"]["Tables"]["deed_documents"]["Row"];
type Activity = Database["public"]["Tables"]["activity_log"]["Row"];

export default async function DeedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [deedResult, documentsResult, activityResult] = await Promise.all([
    workspace.supabase.from("deeds").select("*").eq("id", id).eq("firm_id", workspace.firm.id).maybeSingle(),
    workspace.supabase.from("deed_documents").select("*").eq("deed_id", id).eq("firm_id", workspace.firm.id).order("created_at", { ascending: false }),
    workspace.supabase.from("activity_log").select("*").eq("deed_id", id).eq("firm_id", workspace.firm.id).order("created_at", { ascending: false }).limit(30),
  ]);

  if (!deedResult.data) notFound();

  return (
    <DeedDetail
      activities={(activityResult.data ?? []) as Activity[]}
      deed={deedResult.data as Deed}
      documents={(documentsResult.data ?? []) as Document[]}
      firmCity={workspace.firm.city}
      firmId={workspace.firm.id}
      firmName={workspace.firm.name}
      initialData={parseDeedData(deedResult.data.data)}
    />
  );
}
