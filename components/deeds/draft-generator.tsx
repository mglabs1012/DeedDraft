"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Braces, BookmarkPlus, CheckCircle2, Circle, FileDown, Languages, LoaderCircle, Printer, RotateCcw, Sparkles, Stamp, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { convertForDraft, saveConversions } from "@/app/actions/language";
import { saveDraftAsReference } from "@/app/actions/memory";
import { discardRefinement, refineDraft } from "@/app/actions/refine";
import { DeedReview } from "@/components/deeds/ai/deed-review";
import { Button } from "@/components/ui/button";
import type { DeedType, DraftLanguage, SectionId } from "@/lib/deed-types";
import type { DeedLanguage, DeedStatus } from "@/lib/deeds";
import { buildDraftDocuments, defaultDraftChoice, draftChoices, type DraftChoice, type DraftDocument, type ReadinessItem } from "@/lib/drafting";
import { renderDraftHtml } from "@/lib/drafting/blocks";
import { pendingConversions, usedConversions } from "@/lib/drafting/localize";
import { applyEdits, blockSegments, hashSegments } from "@/lib/drafting/segments";
import type { AiDraftVersion, DeedData, Localized } from "@/lib/schemas/deed-data";
import { cn } from "@/lib/utils";

type Props = {
  aiEnabled?: boolean;
  deedId?: string;
  type: DeedType;
  title: string;
  referenceNo: string;
  language: DeedLanguage;
  data: DeedData;
  firmName: string;
  city: string;
  readiness: ReadinessItem[];
  status: DeedStatus;
  onMarkGenerated: () => void;
  onJump: (tab: SectionId) => void;
  onLocalized?: (localized: Localized) => void;
  onAiDraft?: (aiDraft: DeedData["aiDraft"]) => void;
  pending: boolean;
};

const choiceLabels: Record<DraftChoice, string> = { hindi: "हिंदी", english: "English", both: "Both" };
const langName: Record<DraftLanguage, string> = { hindi: "हिंदी", english: "English" };

function download(content: BlobPart[], type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob(content, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The AI refinement for a language, if it was made for exactly this standard draft. */
function refinedFor(doc: DraftDocument, version: AiDraftVersion | undefined) {
  if (!version) return { state: "none" as const };
  const fresh = hashSegments(blockSegments(doc.blocks)) === version.baseHash;
  return fresh ? { state: "fresh" as const, doc: { ...doc, blocks: applyEdits(doc.blocks, version.edits) } } : { state: "stale" as const };
}

export function DraftGenerator({ aiEnabled, deedId, type, title, referenceNo, language, data, firmName, city, readiness, status, onMarkGenerated, onJump, onLocalized, onAiDraft, pending }: Props) {
  const choices = useMemo(() => draftChoices(type), [type]);
  const [choice, setChoice] = useState<DraftChoice>(() => defaultDraftChoice(type, language));
  const [view, setView] = useState<"ai" | "standard">("ai");
  const [converting, setConverting] = useState<DraftLanguage | null>(null);
  const [refining, setRefining] = useState<DraftLanguage | null>(null);
  const [busy, startTransition] = useTransition();
  const attempted = useRef(new Set<string>());
  const missing = readiness.filter((item) => !item.optional && !item.done);
  const languages = useMemo<DraftLanguage[]>(() => (choice === "both" ? (choices.filter((item) => item !== "both") as DraftLanguage[]) : [choice]), [choice, choices]);

  const standard = useMemo(() => buildDraftDocuments({ type, title, referenceNo, data, firmName, firmCity: city }, choice), [type, title, referenceNo, data, firmName, city, choice]);
  const refined = useMemo(() => standard.map((doc) => ({ language: doc.language, ...refinedFor(doc, data.aiDraft[doc.language]) })), [standard, data.aiDraft]);
  const anyFresh = refined.some((item) => item.state === "fresh");
  const shown = useMemo(() => standard.map((doc, index) => (view === "ai" && refined[index].state === "fresh" ? refined[index].doc! : doc)), [standard, refined, view]);
  const html = useMemo(() => renderDraftHtml({ title: referenceNo + " · " + title, documents: shown, footer: "Ref. " + referenceNo + " · Drafted by " + firmName + ", " + city }), [shown, referenceNo, title, firmName, city]);

  // Automatic Hindi ⇄ English conversion of typed names and addresses for the chosen draft language.
  const pendingByLang = useMemo(() => Object.fromEntries(languages.map((lang) => [lang, pendingConversions(data, lang, [city])])) as Record<DraftLanguage, string[]>, [languages, data, city]);
  useEffect(() => {
    if (!aiEnabled || !deedId || converting) return;
    const lang = languages.find((item) => pendingByLang[item]?.length && !attempted.current.has(item + ":" + pendingByLang[item].join("|")));
    if (!lang) return;
    attempted.current.add(lang + ":" + pendingByLang[lang].join("|"));
    setConverting(lang);
    void convertForDraft({ deedId, language: lang })
      .then((result) => {
        if (result.error !== undefined) return void toast.error(result.error);
        onLocalized?.(result.localized);
        if (result.converted) toast.success(result.converted + " name" + (result.converted === 1 ? "" : "s") + " and address" + (result.converted === 1 ? "" : "es") + " converted to " + (lang === "hindi" ? "Hindi" : "English") + ". Check them below.");
      })
      .finally(() => setConverting(null));
  }, [aiEnabled, deedId, converting, languages, pendingByLang, onLocalized]);

  const refine = (lang: DraftLanguage) => {
    if (!deedId) return;
    setRefining(lang);
    const toastId = toast.loading("AI is polishing the " + (lang === "hindi" ? "Hindi" : "English") + " draft using your accepted drafts…");
    void refineDraft({ deedId, language: lang })
      .then((result) => {
        if (result.error !== undefined) return toast.error(result.error, { id: toastId });
        onAiDraft?.({ ...data.aiDraft, [lang]: result.version });
        setView("ai");
        toast.success(result.version.edits.length ? result.version.edits.length + " improvements made. Review the notes." : "The draft already matches your format — no changes needed.", { id: toastId });
      })
      .catch(() => toast.error("AI refinement failed. Please try again.", { id: toastId }))
      .finally(() => setRefining(null));
  };

  const discard = (lang: DraftLanguage) => {
    if (!deedId) return;
    startTransition(async () => {
      const result = await discardRefinement({ deedId, language: lang });
      if (result.error !== undefined) return void toast.error(result.error);
      const next = { ...data.aiDraft };
      delete next[lang];
      onAiDraft?.(next);
    });
  };

  const saveAsReference = () => {
    if (!deedId || languages.length !== 1) return;
    const text = blockSegments(shown[0].blocks).map((segment) => segment.text).join("\n\n");
    const toastId = toast.loading("Saving this draft to AI memory…");
    startTransition(async () => {
      const result = await saveDraftAsReference({ deedId, language: languages[0], text });
      if (result.error !== undefined) toast.error(result.error, { id: toastId });
      else toast.success("Saved. Future drafts of this type will follow it.", { id: toastId });
    });
  };

  const print = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 300);
  };

  const downloadWord = () => {
    const doc = html.replace("<html>", "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>");
    download(["﻿", doc], "application/msword", referenceNo + (choice === "hindi" ? "-hi" : choice === "english" ? "-en" : "") + ".doc");
  };

  const downloadJson = () => download([JSON.stringify({ referenceNo, type, title, language, data }, null, 2)], "application/json", referenceNo + ".json");

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="font-semibold text-primary">Draft readiness</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{missing.length ? missing.length + " required item" + (missing.length === 1 ? "" : "s") + " left." : "All required details are in place."}</p>
          <ul className="mt-4 space-y-1">
            {readiness.map((item) => (
              <li key={item.label}>
                <button className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => onJump(item.tab)} type="button">
                  {item.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                    {item.label}
                    {item.optional ? <span className="text-xs"> · recommended</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {aiEnabled && deedId ? (
          <section className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 font-semibold text-primary"><Wand2 className="size-4 text-accent-foreground" /> AI drafting</h2>
            <p className="text-sm text-muted-foreground">Polishes the draft to match your accepted drafts and AI memory. Names, amounts, dates and areas are never changed.</p>
            {languages.map((lang, index) => {
              const item = refined[index];
              const version = data.aiDraft[lang];
              return (
                <div className="space-y-2 rounded-lg border border-border bg-card p-3" key={lang}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm font-semibold text-primary", lang === "hindi" && "font-devanagari")}>{langName[lang]}</span>
                    {item.state === "fresh" ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Refined</span> : item.state === "stale" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Out of date</span> : null}
                  </div>
                  {item.state === "stale" ? <p className="text-xs text-amber-800">The matter changed after the last refinement. Refine again to include the changes.</p> : null}
                  {item.state === "fresh" && version?.notes.length ? (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{version.notes.map((note) => <li key={note}>{note}</li>)}</ul>
                  ) : null}
                  <div className="flex gap-2">
                    <Button className="h-9 flex-1" disabled={refining !== null || converting !== null} onClick={() => refine(lang)} type="button" variant={item.state === "fresh" ? "outline" : "default"}>
                      {refining === lang ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {item.state === "none" ? "Refine with AI" : "Refine again"}
                    </Button>
                    {version ? (
                      <Button aria-label="Discard AI changes" className="h-9" disabled={busy} onClick={() => discard(lang)} title="Discard AI changes" type="button" variant="ghost"><RotateCcw className="size-4" /></Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        {aiEnabled && deedId ? <ConversionPanel city={city} converting={converting} data={data} deedId={deedId} languages={languages} onLocalized={onLocalized} pendingByLang={pendingByLang} /> : null}
        {!aiEnabled && languages.some((lang) => pendingConversions(data, lang, [city]).length) ? (
          <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">Some names are typed in the other script. Type them in {languages.includes("hindi") ? "Hindi" : "English"} for this draft, or set up AI to convert them automatically.</p>
        ) : null}

        {aiEnabled && deedId ? <DeedReview deedId={deedId} onJump={onJump} /> : null}

        <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="mb-1 font-semibold text-primary">Export</h2>
          {choices.length > 1 ? (
            <div className="mb-3 grid grid-flow-col gap-1 rounded-lg bg-secondary p-1 text-sm font-semibold" role="tablist">
              {choices.map((item) => (
                <button aria-selected={choice === item} className={cn("rounded-md px-2 py-1.5", item === "hindi" && "font-devanagari", choice === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground")} key={item} onClick={() => setChoice(item)} role="tab" type="button">
                  {choiceLabels[item]}
                </button>
              ))}
            </div>
          ) : null}
          <Button className="h-10 w-full" onClick={downloadWord} type="button"><FileDown className="size-4" /> Download Word (.doc)</Button>
          <Button className="h-10 w-full" onClick={print} type="button" variant="outline"><Printer className="size-4" /> Print / save as PDF</Button>
          {status !== "generated" && status !== "finalized" ? (
            <Button className="h-10 w-full" disabled={pending || missing.length > 0} onClick={onMarkGenerated} type="button" variant="secondary"><Stamp className="size-4" /> Mark as generated</Button>
          ) : null}
          {aiEnabled && deedId && languages.length === 1 ? (
            <Button className="h-10 w-full" disabled={busy} onClick={saveAsReference} title="Accepted for registration? Keep it so future drafts follow it." type="button" variant="ghost"><BookmarkPlus className="size-4" /> Save to AI memory</Button>
          ) : null}
          <button className="flex w-full items-center justify-center gap-2 pt-1 text-xs font-semibold text-muted-foreground hover:text-primary" onClick={downloadJson} type="button"><Braces className="size-3.5" /> Export matter data (JSON)</button>
          <p className="pt-2 text-xs leading-5 text-muted-foreground">Verify every particular against the original documents before execution.</p>
        </section>
      </aside>

      <section className="overflow-hidden rounded-xl border border-border bg-secondary/40 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
          <p className="text-sm font-semibold text-primary">Preview</p>
          <div className="flex items-center gap-2">
            {converting ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-foreground"><LoaderCircle className="size-3.5 animate-spin" /> Converting names to {langName[converting]}…</span> : null}
            {anyFresh ? (
              <div className="grid grid-flow-col gap-1 rounded-lg bg-secondary p-1 text-xs font-semibold" role="tablist">
                {(["ai", "standard"] as const).map((item) => (
                  <button aria-selected={view === item} className={cn("rounded-md px-2.5 py-1", view === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground")} key={item} onClick={() => setView(item)} role="tab" type="button">
                    {item === "ai" ? "AI refined" : "Standard"}
                  </button>
                ))}
              </div>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Draft</span>
            )}
          </div>
        </div>
        <iframe className="h-[70vh] min-h-[480px] w-full bg-white sm:h-[80vh]" sandbox="allow-same-origin" srcDoc={html} title="Draft preview" />
      </section>
    </div>
  );
}

/** Review and correct automatically converted names and addresses. */
function ConversionPanel({ data, deedId, languages, city, converting, pendingByLang, onLocalized }: { data: DeedData; deedId: string; languages: DraftLanguage[]; city: string; converting: DraftLanguage | null; pendingByLang: Record<DraftLanguage, string[]>; onLocalized?: (localized: Localized) => void }) {
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, startTransition] = useTransition();
  const lists = languages.map((lang) => ({ lang, items: usedConversions(data, lang, [city]) })).filter((item) => item.items.length || pendingByLang[item.lang]?.length);
  if (!lists.length && !converting) return null;
  const total = lists.reduce((sum, item) => sum + item.items.length, 0);

  const save = (lang: DraftLanguage) =>
    startTransition(async () => {
      const items = Object.entries(edits).filter(([key]) => key.startsWith(lang + "::")).map(([key, target]) => ({ source: key.slice(lang.length + 2), target }));
      if (!items.length) return;
      const result = await saveConversions({ deedId, language: lang, items });
      if (result.error !== undefined) return void toast.error(result.error);
      onLocalized?.(result.localized);
      setEdits((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(lang + "::"))));
      toast.success("Corrections saved.");
    });

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen((value) => !value)} type="button">
        <span className="flex items-center gap-2 font-semibold text-primary"><Languages className="size-4 text-accent-foreground" /> Converted names & addresses</span>
        <span className="text-xs font-semibold text-muted-foreground">{converting ? "Converting…" : total + " · " + (open ? "Hide" : "Check")}</span>
      </button>
      <p className="mt-1 text-xs text-muted-foreground">Typed in one script, shown in the draft&apos;s script automatically. Correct any spelling below — names must match the ID papers.</p>
      {open ? (
        <div className="mt-3 space-y-4">
          {lists.map(({ lang, items }) => (
            <div className="space-y-2" key={lang}>
              <p className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground", lang === "hindi" && "font-devanagari normal-case")}>In {langName[lang]}</p>
              {items.map(({ source, target }) => {
                const key = lang + "::" + source;
                return (
                  <label className="block space-y-1" key={key}>
                    <span className="block truncate text-xs text-muted-foreground" title={source}>{source}</span>
                    <input className={cn("h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary", lang === "hindi" && "font-devanagari")} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} value={edits[key] ?? target} />
                  </label>
                );
              })}
              {Object.keys(edits).some((key) => key.startsWith(lang + "::")) ? (
                <Button className="h-9 w-full" disabled={saving} onClick={() => save(lang)} type="button">{saving ? <LoaderCircle className="size-4 animate-spin" /> : null} Save corrections</Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
