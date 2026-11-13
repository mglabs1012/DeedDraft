import Link from "next/link";
import { Crown, FileText } from "lucide-react";

import { NewDeedForm } from "@/components/deeds/new-deed-form";
import { isDeedType } from "@/lib/deed-types";
import { getLibraryEntry, libraryIndex } from "@/lib/templates/library.server";
import { cn } from "@/lib/utils";

export const metadata = { title: "New deed" };

const modes = {
  standard: { label: "Standard Mode", icon: FileText, title: "Choose your document.", text: "One guided page: upload papers, check the details the AI reads, prepare the draft. 950+ templates." },
  premium: { label: "Premium Mode", icon: Crown, title: "Choose the deed type.", text: "Every part of the matter in its own section — papers, people, property, title, payments, terms — with a readiness checklist and AI legal review. For complex matters." },
} as const;

export default async function NewDeedPage({ searchParams }: { searchParams: Promise<{ type?: string; template?: string; mode?: string }> }) {
  const params = await searchParams;
  const mode = params.mode === "premium" ? "premium" : "standard";
  const initialTemplate = mode === "standard" ? getLibraryEntry(params.template) ?? undefined : undefined;
  const initialType = !initialTemplate && isDeedType(params.type) ? params.type : undefined;
  const keep = (next: "standard" | "premium") => "/app/deeds/new?mode=" + next + (initialType ? "&type=" + initialType : "");

  return (
    <div>
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">New deed</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{modes[mode].title}</h1>
      <div role="tablist" aria-label="Workspace mode" className="mt-4 inline-flex rounded-xl bg-secondary p-1 text-sm">
        {(["standard", "premium"] as const).map((item) => {
          const Icon = modes[item].icon;
          return <Link key={item} role="tab" aria-selected={mode === item} replace scroll={false} href={keep(item)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition", mode === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-primary")}><Icon className="size-4" />{modes[item].label}</Link>;
        })}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{modes[mode].text} You can switch a deed between modes later; nothing is lost.</p>
      <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-7">
        <NewDeedForm key={mode} mode={mode} initialTemplate={initialTemplate} initialType={initialType} library={libraryIndex} />
      </section>
    </div>
  );
}
