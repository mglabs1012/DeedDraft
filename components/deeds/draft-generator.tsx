"use client";

import { useMemo, useState } from "react";
import { Braces, CheckCircle2, Circle, Eye, FileDown, PenLine, Printer, Stamp } from "lucide-react";

import type { SavedDraft } from "@/app/actions/drafts";
import { DeedReview } from "@/components/deeds/ai/deed-review";
import { DraftStudio } from "@/components/deeds/draft-studio";
import { Button } from "@/components/ui/button";
import { getDeedType, type DeedType, type DraftLanguage, type SectionId } from "@/lib/deed-types";
import type { DeedLanguage, DeedStatus } from "@/lib/deeds";
import { buildDraft, defaultDraftChoice, draftChoices, generateEditable, type DraftChoice, type EditableDraft, type ReadinessItem } from "@/lib/drafting";
import { editableDraftSchema } from "@/lib/drafting/editable";
import type { DeedData } from "@/lib/schemas/deed-data";
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
  pending: boolean;
  savedDrafts?: SavedDraft[];
  onDraftSaved?: (draft: SavedDraft) => void;
};

const choiceLabels: Record<DraftChoice, string> = { hindi: "हिंदी", english: "English", both: "Both" };

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

export function DraftGenerator({ aiEnabled, deedId, type, title, referenceNo, language, data, firmName, city, readiness, status, onMarkGenerated, onJump, pending, savedDrafts = [], onDraftSaved }: Props) {
  const choices = draftChoices(type);
  const [choice, setChoice] = useState<DraftChoice>(() => defaultDraftChoice(type, language));
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [useEdited, setUseEdited] = useState(true);
  const input = useMemo(() => ({ type, title, referenceNo, data, firmName, firmCity: city }), [type, title, referenceNo, data, firmName, city]);
  const latest = useMemo(() => {
    const result: Partial<Record<DraftLanguage, { draft: EditableDraft; version: number }>> = {};
    for (const saved of [...savedDrafts].sort((a, b) => b.version - a.version)) {
      if (result[saved.language]) continue;
      const parsed = editableDraftSchema.safeParse(saved.content);
      if (parsed.success) result[saved.language] = { draft: parsed.data as EditableDraft, version: saved.version };
    }
    return result;
  }, [savedDrafts]);
  const overrides = useMemo(
    () => (useEdited ? Object.fromEntries(Object.entries(latest).map(([key, value]) => [key, value!.draft])) : {}) as Partial<Record<DraftLanguage, EditableDraft>>,
    [latest, useEdited],
  );
  const editedNote = Object.entries(latest).map(([key, value]) => (key === "hindi" ? "हिंदी" : "English") + " v" + value!.version).join(", ");
  const { html } = useMemo(() => buildDraft(input, choice, overrides), [input, choice, overrides]);
  const generators = useMemo(
    () => Object.fromEntries(getDeedType(type).languages.map((item) => [item, () => generateEditable(input, item)])) as Record<DraftLanguage, () => EditableDraft>,
    [input, type],
  );
  const missing = readiness.filter((item) => !item.optional && !item.done);

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

  const downloadJson = () => {
    download([JSON.stringify({ referenceNo, type, title, language, data }, null, 2)], "application/json", referenceNo + ".json");
  };

  const toggle = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm font-semibold shadow-sm" role="tablist">
        <button aria-selected={mode === "preview"} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5", mode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")} onClick={() => setMode("preview")} role="tab" type="button"><Eye className="size-4" /> Preview & export</button>
        <button aria-selected={mode === "edit"} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5", mode === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")} onClick={() => setMode("edit")} role="tab" type="button"><PenLine className="size-4" /> Edit{aiEnabled ? " & chat with AI" : " draft"}</button>
      </div>
      {editedNote ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input checked={useEdited} className="size-4 accent-[var(--primary)]" onChange={(event) => setUseEdited(event.target.checked)} type="checkbox" />
          Use edited version ({editedNote})
        </label>
      ) : null}
    </div>
  );

  if (mode === "edit" && deedId) {
    return (
      <div className="space-y-4">
        {toggle}
        <DraftStudio aiEnabled={Boolean(aiEnabled)} deedId={deedId} generated={generators} languages={getDeedType(type).languages} onSaved={(draft) => onDraftSaved?.(draft)} saved={savedDrafts} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
    {deedId ? toggle : null}
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="font-semibold text-primary">Draft readiness</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {missing.length ? missing.length + " required item" + (missing.length === 1 ? "" : "s") + " left." : "All required details are in place."}
          </p>
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
            <Button className="h-10 w-full" disabled={pending || missing.length > 0} onClick={onMarkGenerated} type="button" variant="secondary">
              <Stamp className="size-4" /> Mark as generated
            </Button>
          ) : null}
          <button className="flex w-full items-center justify-center gap-2 pt-1 text-xs font-semibold text-muted-foreground hover:text-primary" onClick={downloadJson} type="button">
            <Braces className="size-3.5" /> Export matter data (JSON)
          </button>
          <p className="pt-2 text-xs leading-5 text-muted-foreground">Drafts follow the firm&apos;s Rajasthan drafting format. Verify every particular against the original documents before execution.</p>
        </section>
      </aside>
      <section className="overflow-hidden rounded-xl border border-border bg-secondary/40 shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <p className="text-sm font-semibold text-primary">Preview</p>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Draft</span>
        </div>
        <iframe className="h-[70vh] min-h-[480px] w-full bg-white sm:h-[80vh]" sandbox="allow-same-origin" srcDoc={html} title="Draft preview" />
      </section>
    </div>
    </div>
  );
}
