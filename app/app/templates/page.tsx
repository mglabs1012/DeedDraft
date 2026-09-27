import Link from "next/link";
import { BookTemplate, Plus } from "lucide-react";

export default function TemplatesPage() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <section className="max-w-lg text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary text-accent-foreground"><BookTemplate className="size-6" /></span><p className="mt-6 text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Future phase</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Template library coming soon</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Lawyer-approved deed templates will live here, ready to use once drafting generation is enabled.</p><Link className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/app/deeds/new"><Plus className="size-4" /> Start a deed instead</Link></section>
    </div>
  );
}
