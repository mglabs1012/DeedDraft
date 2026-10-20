import Link from "next/link";
import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Your workspace" };

export default async function DashboardPage() {
  const { supabase, firm } = await requireWorkspace();
  const { data: deeds, error } = await supabase.from("deeds")
    .select("id, title, reference_no, updated_at").eq("firm_id", firm.id)
    .order("updated_at", { ascending: false }).limit(5);
  return (
    <div className="mx-auto max-w-6xl">
      <section className="pb-12 pt-8 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[.2em] text-muted-foreground">Your drafting workspace</p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight text-primary sm:text-5xl">Your papers. A clearer draft.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Start with a template. Upload your documents, tell us what you need, and review the draft together.</p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          <Link data-tour="standard-mode" href="/app/deeds/new" className="group flex min-h-48 flex-col rounded-2xl border border-primary/25 bg-card p-6 transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary">
            <FileText className="size-5 text-primary" /><h2 className="mt-5 text-lg font-semibold text-primary">Standard Mode</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Your documents, guided by AI. Simple from start to draft.</p>
            <span className="mt-6 flex items-center gap-2 text-sm font-medium text-primary">Choose a template <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </Link>
          <div aria-disabled="true" className="flex min-h-48 flex-col rounded-2xl border border-border bg-secondary/20 p-6">
            <Sparkles className="size-5 text-muted-foreground" /><div className="mt-5 flex items-center gap-3"><h2 className="text-lg font-semibold text-muted-foreground">Premium Mode</h2><span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Coming later</span></div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">A workspace for more complex matters. Standard Mode is ready to use now.</p>
          </div>
        </div>
      </section>
      <section data-tour="recent-deeds" aria-labelledby="recent-heading" className="border-t border-border pt-7">
        <div className="flex items-center justify-between"><h2 id="recent-heading" className="text-sm font-medium text-primary">Continue a deed</h2><Link href="/app/deeds" className="text-xs text-muted-foreground hover:text-primary">View all</Link></div>
        {error ? <p role="alert" className="mt-5 text-sm text-destructive">Recent deeds could not be loaded. Refresh to try again.</p> : !deeds?.length ? <p className="mt-5 text-sm text-muted-foreground">Your recent work will appear here.</p> : <ul className="mt-3 divide-y divide-border">{deeds.map((deed) => <li key={deed.id}><Link href={"/app/deeds/" + deed.id} className="flex items-center justify-between gap-4 py-4 text-sm hover:text-primary"><span className="min-w-0 truncate">{deed.title}</span><span className="shrink-0 text-xs text-muted-foreground">{deed.reference_no}</span></Link></li>)}</ul>}
      </section>
    </div>
  );
}
