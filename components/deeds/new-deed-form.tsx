"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { createDeed } from "@/app/actions/deeds";
import { DeedIcon } from "@/components/deeds/deed-icon";
import { TemplateSearch } from "@/components/templates/template-search";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { coreItems, libraryItems, type CatalogItem, type LibraryEntry } from "@/lib/templates/catalog";

export function NewDeedForm({ library, initialType, initialTemplate, mode = "standard" }: { library: LibraryEntry[]; initialType?: DeedType; initialTemplate?: LibraryEntry; aiEnabled?: boolean; mode?: "standard" | "premium" }) {
  const router = useRouter();
  const creating = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const suggested = mode === "standard" && initialTemplate ? libraryItems([initialTemplate])[0] : coreItems().find((item) => item.id === initialType);
  const choose = async (item: CatalogItem) => {
    if (creating.current) return;
    creating.current = true;
    setSelected(item.title);
    try {
      const type = item.kind === "core" ? item.id as DeedType : "other";
      const result = await createDeed({
        deedType: type, title: item.title, mode,
        language: item.kind === "core" ? getDeedType(type).defaultLanguage : "english",
        ...(item.kind === "library" ? { templateId: item.id } : {}),
      });
      if (result.error || !result.id) throw new Error(result.error || "Could not create the deed.");
      // Premium opens on Papers, the first section to fill; Standard opens on its single guided page.
      router.push("/app/deeds/" + result.id + (mode === "premium" ? "?tab=documents" : ""));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the deed. Please try again.");
      creating.current = false;
      setSelected(null);
    }
  };
  return (
    <div data-tour="templates" aria-busy={Boolean(selected)}>
      {selected ? <p role="status" className="mb-4 flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" /> Opening {selected}…</p> : null}
      <fieldset disabled={Boolean(selected)} className="min-w-0">
        {suggested ? <button type="button" className="mb-5 w-full rounded-xl border border-primary/20 bg-primary/5 p-4 text-left text-sm font-medium text-primary" onClick={() => void choose(suggested)}>Start with {suggested.title} →</button> : null}
        {mode === "premium" ? <PremiumTypes onSelect={(item) => void choose(item)} /> : <TemplateSearch library={library} onSelect={(item) => void choose(item)} />}
      </fieldset>
    </div>
  );
}

/** Premium works on structured facts, so it offers the eight built-in deed types with their key features. */
function PremiumTypes({ onSelect }: { onSelect: (item: CatalogItem) => void }) {
  return <ul className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(3,minmax(0,1fr))]">
    {coreItems().map((item) => {
      const config = getDeedType(item.id);
      return <li key={item.id} className="min-w-0">
        <button type="button" onClick={() => onSelect(item)} className="flex h-full w-full flex-col rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
          <span className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><DeedIcon type={item.id as DeedType} className="size-5" /></span><span className="min-w-0"><span className="block font-semibold text-primary">{item.title}</span><span className="block font-devanagari text-xs text-muted-foreground">{item.subtitle}</span></span></span>
          <span className="mt-3 text-sm text-muted-foreground">{config.description}</span>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{config.highlights.slice(0, 3).map((highlight) => <li key={highlight} className="flex gap-1.5"><Check className="mt-0.5 size-3 shrink-0 text-emerald-600" />{highlight}</li>)}</ul>
        </button>
      </li>;
    })}
  </ul>;
}
