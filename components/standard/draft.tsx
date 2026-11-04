"use client";

import { useMemo, useState, useTransition } from "react";
import { Languages, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { DraftStudio } from "@/components/deeds/draft-studio";
import type { SavedDraft } from "@/app/actions/drafts";
import { saveConversions } from "@/app/actions/language";
import { Button } from "@/components/ui/button";
import type { DraftLanguage } from "@/lib/deed-types";
import { generateEditable } from "@/lib/drafting";
import { finalChecks } from "@/lib/drafting/checks";
import type { EditableDraft } from "@/lib/drafting/editable";
import { usedConversions } from "@/lib/drafting/localize";
import type { DeedData, Localized } from "@/lib/schemas/deed-data";
import type { Deed } from "@/types/database";

export function StandardDraft({ deed, data, firmName, firmCity, aiEnabled, drafts, onSaved, onLocalized }: {
  deed: Deed; data: DeedData; firmName: string; firmCity: string; aiEnabled: boolean;
  drafts: SavedDraft[]; onSaved: (draft: SavedDraft) => void; onLocalized: (localized: Localized) => void;
}) {
  const languages = useMemo(() => (["hindi", "english"] as const).filter((language) => drafts.some((draft) => draft.language === language)), [drafts]);
  const generated = useMemo(() => Object.fromEntries(["hindi", "english"].map((language) => [language, () => {
    const lang = language as DraftLanguage;
    const custom = data.custom?.drafts[lang];
    if (custom) return { language: lang, blocks: [{ id: "title", kind: "title", text: custom.title }, ...custom.paragraphs.map((text, i) => ({ id: "p" + i, kind: "para", text }))] } as EditableDraft;
    return generateEditable({ type: deed.deed_type, title: deed.title, referenceNo: deed.reference_no, data, firmName, firmCity }, lang);
  }])) as Record<DraftLanguage, () => EditableDraft>, [data, deed, firmName, firmCity]);
  const checks = useMemo(() => finalChecks(deed.deed_type, data, ""), [deed.deed_type, data]);
  const errors = checks.filter((check) => check.severity === "error");
  if (!languages.length) return <p className="py-10 text-sm text-muted-foreground">No saved draft yet. Prepare a draft from Papers &amp; details.</p>;
  return <div data-tour="draft-review" className="space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">Read the draft against the papers before signing or registration. Edit any text directly, or ask the assistant to add, keep or remove clauses. Changes to the people, property or payments need a new version from Papers &amp; details.</p>
    {checks.length ? <details className={"rounded-lg border p-3 text-sm " + (errors.length ? "border-destructive/30 bg-destructive/5" : "border-amber-200 bg-amber-50/50")} open={errors.length > 0}>
      <summary className="flex cursor-pointer items-center gap-2 font-medium"><TriangleAlert className={"size-4 " + (errors.length ? "text-destructive" : "text-amber-700")} />{errors.length ? errors.length + " problem" + (errors.length === 1 ? "" : "s") + " to fix" : ""}{errors.length && checks.length > errors.length ? " · " : ""}{checks.length > errors.length ? (checks.length - errors.length) + " point" + (checks.length - errors.length === 1 ? "" : "s") + " to review" : ""}</summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5">{checks.map((check) => <li key={check.id} className={check.severity === "error" ? "text-destructive" : undefined}>{check.message}</li>)}</ul>
    </details> : null}
    <NameConversions deedId={deed.id} data={data} firmCity={firmCity} languages={languages} onLocalized={onLocalized} />
    <DraftStudio deedId={deed.id} languages={[...languages]} generated={generated} saved={drafts} aiEnabled={aiEnabled} onSaved={onSaved} exportTitle={deed.reference_no + " - " + deed.title} />
  </div>;
}

/** Names, places and words written in the draft's script: shown for checking and correction. */
function NameConversions({ deedId, data, firmCity, languages, onLocalized }: { deedId: string; data: DeedData; firmCity: string; languages: readonly DraftLanguage[]; onLocalized: (localized: Localized) => void }) {
  const [language, setLanguage] = useState<DraftLanguage>(languages[0]);
  const entries = useMemo(() => usedConversions(data, language, [firmCity]), [data, language, firmCity]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const changed = entries.filter((entry) => edits[entry.source] !== undefined && edits[entry.source].trim() !== entry.target);
  if (!languages.some((item) => usedConversions(data, item, [firmCity]).length)) return null;
  const save = () => startTransition(async () => {
    const result = await saveConversions({ deedId, language, items: changed.map((entry) => ({ source: entry.source, target: edits[entry.source].trim() })) });
    if (result.error !== undefined) return void toast.error(result.error);
    onLocalized(result.localized);
    setEdits({});
    toast.success("Spellings saved", { description: "They are used in every new version and remembered for this firm's next deeds. Choose Versions → Regenerate from matter data to see them now.", duration: 6000 });
  });
  return <details className="rounded-lg border border-border bg-card text-sm">
    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 font-medium text-primary"><Languages className="size-4" /> Names in the draft language <span className="font-normal text-muted-foreground">· {entries.length} written {language === "hindi" ? "in Hindi" : "in English"} — check spellings</span></summary>
    <div className="border-t border-border px-4 py-3">
      {languages.length > 1 ? <div className="mb-3 inline-flex rounded-lg bg-secondary p-1 text-xs font-semibold">{languages.map((item) => <button key={item} type="button" onClick={() => { setLanguage(item); setEdits({}); }} className={"rounded-md px-3 py-1 " + (item === language ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>{item === "hindi" ? "हिंदी" : "English"}</button>)}</div> : null}
      {entries.length ? <ul className="grid gap-2 sm:grid-cols-2">{entries.map((entry) => <li key={entry.source} className="grid gap-1 rounded-lg bg-secondary/40 p-2">
        <span className="truncate text-xs text-muted-foreground" title={entry.source}>{entry.source}</span>
        <input aria-label={"Written as, for " + entry.source} className={"h-9 rounded-md border border-border bg-background px-2 text-sm " + (language === "hindi" ? "font-devanagari" : "")} value={edits[entry.source] ?? entry.target} onChange={(event) => setEdits((current) => ({ ...current, [entry.source]: event.target.value }))} />
      </li>)}</ul> : <p className="text-xs text-muted-foreground">Nothing needed converting for this language.</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        {changed.length ? <span className="text-xs text-muted-foreground">{changed.length} change{changed.length === 1 ? "" : "s"}</span> : null}
        <Button className="h-9" disabled={!changed.length || pending} onClick={save} type="button">{pending ? <LoaderCircle className="size-4 animate-spin" /> : null} Save spellings</Button>
      </div>
    </div>
  </details>;
}
