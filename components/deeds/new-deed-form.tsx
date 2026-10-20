"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { createDeed } from "@/app/actions/deeds";
import { TemplateSearch } from "@/components/templates/template-search";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { coreItems, libraryItems, type CatalogItem, type LibraryEntry } from "@/lib/templates/catalog";

export function NewDeedForm({ library, initialType, initialTemplate }: { library: LibraryEntry[]; initialType?: DeedType; initialTemplate?: LibraryEntry; aiEnabled?: boolean }) {
  const router = useRouter();
  const creating = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const suggested = initialTemplate ? libraryItems([initialTemplate])[0] : coreItems().find((item) => item.id === initialType);
  const choose = async (item: CatalogItem) => {
    if (creating.current) return;
    creating.current = true;
    setSelected(item.title);
    try {
      const type = item.kind === "core" ? item.id as DeedType : "other";
      const result = await createDeed({
        deedType: type, title: item.title,
        language: item.kind === "core" ? getDeedType(type).defaultLanguage : "english",
        ...(item.kind === "library" ? { templateId: item.id } : {}),
      });
      if (result.error || !result.id) throw new Error(result.error || "Could not create the deed.");
      router.push("/app/deeds/" + result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the deed. Please try again.");
      creating.current = false;
      setSelected(null);
    }
  };
  return (
    <div aria-busy={Boolean(selected)}>
      {selected ? <p role="status" className="mb-4 flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" /> Opening {selected}…</p> : null}
      <fieldset disabled={Boolean(selected)} className="min-w-0">
        {suggested ? <button type="button" className="mb-5 w-full rounded-xl border border-primary/20 bg-primary/5 p-4 text-left text-sm font-medium text-primary" onClick={() => void choose(suggested)}>Start with {suggested.title} →</button> : null}
        <TemplateSearch library={library} onSelect={(item) => void choose(item)} />
      </fieldset>
    </div>
  );
}
