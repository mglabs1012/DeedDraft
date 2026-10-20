"use client";

import { useMemo } from "react";
import { DraftStudio } from "@/components/deeds/draft-studio";
import type { SavedDraft } from "@/app/actions/drafts";
import { generateEditable } from "@/lib/drafting";
import { finalChecks } from "@/lib/drafting/checks";
import type { EditableDraft } from "@/lib/drafting/editable";
import type { DeedData } from "@/lib/schemas/deed-data";
import type { Deed } from "@/types/database";

export function StandardDraft({ deed, data, firmName, firmCity, aiEnabled, drafts, onSaved }: {
  deed: Deed; data: DeedData; firmName: string; firmCity: string; aiEnabled: boolean;
  drafts: SavedDraft[]; onSaved: (draft: SavedDraft) => void;
}) {
  const languages = useMemo(() => Array.from(new Set(drafts.map((draft) => draft.language))), [drafts]);
  const generated = useMemo(() => Object.fromEntries(["hindi", "english"].map((language) => [language, () => {
    const lang = language as "hindi" | "english";
    const custom = data.custom?.drafts[lang];
    if (custom) return { language: lang, blocks: [{ id: "title", kind: "title", text: custom.title }, ...custom.paragraphs.map((text, i) => ({ id: "p" + i, kind: "para", text }))] } as EditableDraft;
    return generateEditable({ type: deed.deed_type, title: deed.title, referenceNo: deed.reference_no, data, firmName, firmCity }, lang);
  }])) as Record<"hindi" | "english", () => EditableDraft>, [data, deed, firmName, firmCity]);
  const checks = finalChecks(deed.deed_type, data, "");
  if (!languages.length) return <p>No saved draft yet.</p>;
  return <div className="space-y-4">
    <p className="text-xs leading-5 text-muted-foreground">Review before signing or registration. Ask the assistant to add, retain or remove clauses, then apply its proposed edits. Saved versions preserve your work; changes to matter details require preparing a new version.</p>
    {checks.length ? <details className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs"><summary className="cursor-pointer font-medium">{checks.length} checks to review</summary><ul className="mt-2 list-disc space-y-1 pl-5">{checks.map((check) => <li key={check.id}>{check.message}</li>)}</ul></details> : null}
    <DraftStudio deedId={deed.id} languages={languages} generated={generated} saved={drafts} aiEnabled={aiEnabled} onSaved={onSaved} exportTitle={deed.reference_no + " - " + deed.title} />
  </div>;
}
