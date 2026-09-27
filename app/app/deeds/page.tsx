import Link from "next/link";
import { Plus } from "lucide-react";

import { DeedsTable } from "@/components/deeds/deeds-table";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { Deed } from "@/types/database";

export default async function DeedsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const { data } = await workspace.supabase
    .from("deeds")
    .select("*")
    .eq("firm_id", workspace.firm.id)
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Matter register</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Deeds</h1><p className="mt-2 text-sm text-muted-foreground">Search, filter, and keep every active matter organised.</p></div>
        <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/app/deeds/new"><Plus className="size-4" /> New deed</Link>
      </div>
      <section className="mt-7 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"><DeedsTable deeds={(data ?? []) as Deed[]} /></section>
    </div>
  );
}
