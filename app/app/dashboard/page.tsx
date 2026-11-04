import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { getDeedType } from "@/lib/deed-types";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Your workspace" };

const quickTypes = ["sale", "agreement_to_sell", "gift", "rent", "lease", "will"] as const;

export default async function DashboardPage() {
  const { supabase, firm } = await requireWorkspace();
  const { data: deeds, error } = await supabase.from("deeds")
    .select("id, title, reference_no, deed_type, updated_at").eq("firm_id", firm.id)
    .order("updated_at", { ascending: false }).limit(6);
  return (
    <div className="mx-auto max-w-5xl">
      <section className="pb-10 pt-4 sm:pb-12 sm:pt-10">
        <p className="text-xs font-medium uppercase tracking-[.2em] text-muted-foreground">{firm.name}</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-primary sm:text-4xl">Your papers. A clearer draft.</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">Pick a document, upload the property papers, check the details and prepare the draft — in Hindi, English or both.</p>
        <Link data-tour="standard-mode" href="/app/deeds/new" className="group mt-7 flex items-center gap-4 rounded-2xl border border-primary/25 bg-card p-5 transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><FileText className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-primary">Start a new deed</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">Choose from sale, gift, rent and 950+ other templates.</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-primary transition group-hover:translate-x-1" />
        </Link>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Common documents">
          {quickTypes.map((type) => {
            const config = getDeedType(type);
            return <Link key={type} href={"/app/deeds/new?type=" + type} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary">{config.label} <span className="font-devanagari text-xs">· {config.labelHi}</span></Link>;
          })}
        </div>
      </section>
      <section data-tour="recent-deeds" aria-labelledby="recent-heading" className="border-t border-border pt-7">
        <div className="flex items-center justify-between"><h2 id="recent-heading" className="text-sm font-medium text-primary">Continue a deed</h2><Link href="/app/deeds" className="text-sm text-muted-foreground hover:text-primary">View all</Link></div>
        {error ? <p role="alert" className="mt-5 text-sm text-destructive">Recent deeds could not be loaded. Refresh to try again.</p>
          : !deeds?.length ? <p className="mt-5 text-sm text-muted-foreground">Your recent work will appear here.</p>
          : <ul className="mt-3 divide-y divide-border">{deeds.map((deed) => (
            <li key={deed.id}>
              <Link href={"/app/deeds/" + deed.id} className="flex items-center justify-between gap-4 py-3.5 text-sm hover:text-primary">
                <span className="min-w-0"><span className="block truncate font-medium">{deed.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{getDeedType(deed.deed_type).label} · {deed.reference_no}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(deed.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </Link>
            </li>
          ))}</ul>}
      </section>
    </div>
  );
}
