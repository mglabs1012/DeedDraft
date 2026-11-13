"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Bot, Check, FileDown, GraduationCap, History, LoaderCircle, MessageSquare, Pencil, Plus, Printer, RefreshCw, RotateCcw, Save, Undo2, Send, ShieldCheck, Trash2, TriangleAlert, Wand2, X } from "lucide-react";
import { toast } from "sonner";

import { chatEditDraft, reviewDraftText } from "@/app/actions/ai";
import { saveDraftVersion, type SavedDraft } from "@/app/actions/drafts";
import { saveDraftAsReference } from "@/app/actions/memory";
import { loadDraftVersion } from "@/app/actions/standard-draft";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import type { ReviewIssue } from "@/lib/ai/parse";
import type { DraftLanguage } from "@/lib/deed-types";
import { renderBlock, renderDraftHtml } from "@/lib/drafting/blocks";
import { printHtml } from "@/lib/drafting/print";
import { safeFileName } from "@/lib/drafting/transliterate";
import { applyOperations, fromEditable, lockedToBlock, markupToHtml, type EditableBlock, type EditableDraft, type EditOperation, type LockedBlock, type TextKind } from "@/lib/drafting/editable";
import { LockedEditor } from "./locked-editor";
import { cn } from "@/lib/utils";

type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; operations?: EditOperation[]; status?: "pending" | "applied" | "discarded"; issues?: ReviewIssue[] };

const kindStyles: Record<TextKind, string> = {
  invocation: "text-center text-lg",
  title: "text-center text-xl font-bold underline underline-offset-4",
  meta: "text-center text-sm text-muted-foreground",
  heading: "text-center font-semibold underline underline-offset-2",
  para: "",
  clause: "",
  detail: "text-sm",
};

const kindLabels: Record<TextKind, string> = { invocation: "Invocation", title: "Title", meta: "Sub-title", heading: "Heading", para: "Paragraph", clause: "Clause", detail: "Detail" };

const blockBase = "w-full rounded-md border border-transparent px-2 py-1.5 leading-7";

/** A block as it will print: bold names, no markup. Click, tap or Enter to edit. */
function BlockText({ value, className, hindi, onEdit }: { value: string; className?: string; hindi: boolean; onEdit: () => void }) {
  return (
    <div
      aria-label="Edit text"
      className={cn(blockBase, "cursor-text whitespace-pre-wrap break-words hover:border-border hover:bg-secondary/30 focus-visible:border-primary focus-visible:outline-none", hindi && "font-devanagari text-[15px]", className)}
      dangerouslySetInnerHTML={{ __html: markupToHtml(value).value || "&nbsp;" }}
      onClick={onEdit}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdit(); } }}
      role="button"
      tabIndex={0}
    />
  );
}

function AutoText({ value, onChange, className, hindi, onDone }: { value: string; onChange: (value: string) => void; className?: string; hindi: boolean; onDone?: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const editingNow = Boolean(onDone);
  // Opened from the reading view: caret at the end of the paragraph.
  useEffect(() => {
    const element = ref.current;
    if (!element || !editingNow) return;
    element.setSelectionRange(element.value.length, element.value.length);
  }, [editingNow]);
  // Sized before paint (no visible jump), and again when the column width changes.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => { element.style.height = "auto"; element.style.height = element.scrollHeight + "px"; };
    fit();
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fit();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return (
    <textarea
      autoFocus={Boolean(onDone)}
      className={cn(blockBase, "resize-none overflow-hidden bg-transparent outline-none transition hover:border-border focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/10", hindi && "font-devanagari text-[15px]", className)}
      onBlur={onDone}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Escape") onDone?.(); }}
      ref={ref}
      rows={1}
      value={value}
    />
  );
}

/** Unique id for a block the user adds (never reused across saved versions). */
const freshBlockId = () => "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Floating toolbar shown on hover or focus: move, insert, edit, delete. Takes no space in the page. */
const formats: Array<[Format, string]> = [["para", "Paragraph"], ["clause", "Clause"], ["numbered", "Numbered clause"], ["detail", "List item"], ["heading", "Heading"], ["center", "Centred line"]];
type Format = "para" | "clause" | "numbered" | "detail" | "heading" | "center";

function formatOf(block: Extract<EditableBlock, { text: string }>): Format | null {
  if (block.kind === "clause") return block.numbered ? "numbered" : "clause";
  if (block.kind === "para") return block.center ? "center" : "para";
  return block.kind === "detail" || block.kind === "heading" ? block.kind : null;
}

function BlockTools({ first, last, onUp, onDown, onInsert, onDelete, onEdit, format, onFormat }: { first: boolean; last: boolean; onUp: () => void; onDown: () => void; onInsert: () => void; onDelete: () => void; onEdit?: () => void; format?: Format | null; onFormat?: (format: Format) => void }) {
  const tool = "rounded p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent";
  // Sits just above the block so it never covers the text being read or edited. Pressing a tool must not take the
  // focus away from the paragraph being edited (on phones the toolbar would vanish before the tap landed).
  return <div onMouseDown={(event) => { if (!(event.target as HTMLElement).closest("select")) event.preventDefault(); }} className="pointer-events-none absolute -top-7 right-1 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 font-sans opacity-0 shadow-md transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
    {format && onFormat ? <select aria-label="Format" title="Format" className="h-7 max-w-32 rounded border-0 bg-transparent px-1 text-xs text-muted-foreground outline-none hover:bg-secondary focus:ring-1 focus:ring-primary/30" value={format} onChange={(event) => onFormat(event.target.value as Format)}>{formats.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : null}
    {onEdit ? <button aria-label="Edit" className={tool} onClick={onEdit} title="Edit" type="button"><Pencil className="size-3.5" /></button> : null}
    <button aria-label="Move up" className={tool} disabled={first} onClick={onUp} title="Move up" type="button"><ArrowUp className="size-3.5" /></button>
    <button aria-label="Move down" className={tool} disabled={last} onClick={onDown} title="Move down" type="button"><ArrowDown className="size-3.5" /></button>
    <button aria-label="Insert clause below" className={tool} onClick={onInsert} title="Insert clause below" type="button"><Plus className="size-3.5" /></button>
    <button aria-label="Delete" className={cn(tool, "hover:bg-destructive/10 hover:text-destructive")} onClick={onDelete} title="Delete" type="button"><Trash2 className="size-3.5" /></button>
  </div>;
}

export function DraftStudio({
  deedId,
  languages,
  generated,
  saved,
  aiEnabled,
  onSaved,
  exportTitle,
  currentBasis,
  onEditDetails,
  onDirtyChange,
}: {
  deedId: string;
  languages: DraftLanguage[];
  generated: Record<DraftLanguage, () => EditableDraft>;
  saved: SavedDraft[];
  aiEnabled: boolean;
  onSaved: (draft: SavedDraft) => void;
  exportTitle?: string;
  /** Fingerprint of the current matter facts; differs from the draft's when details were corrected after it was prepared. */
  currentBasis?: string;
  /** Opens the details (people, property, payments, terms) for correction. */
  onEditDetails?: () => void;
  /** Tells the workspace whether the open draft has edits that are not saved as a version yet. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [language, setLanguage] = useState<DraftLanguage>(languages[0]);
  const versions = useMemo(() => saved.filter((item) => item.language === language).sort((a, b) => b.version - a.version), [saved, language]);
  const [draft, setDraft] = useState<EditableDraft>(() => (versions[0]?.content as EditableDraft | undefined) ?? generated[language]());
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(draft));
  /** Number of the saved version that is open (null: a generated draft not saved yet). */
  const [opened, setOpened] = useState<number | null>(() => (versions[0]?.content ? versions[0].version : null));
  /** Earlier states of the draft, for step-by-step Undo. */
  const [past, setPast] = useState<EditableDraft[]>([]);
  const [opening, setOpening] = useState(false);
  const fetched = useRef(new Map<string, EditableDraft>());
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [message, setMessage] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // Narrow screens: the assistant opens as a bottom sheet; wide screens always show it beside the draft.
  const [sheet, setSheet] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  // Numbers of numbered clauses and list items, counted the way the printed deed numbers them (each run starts at 1).
  const numbers = useMemo(() => {
    const out = new Map<string, number>();
    let run = "";
    let count = 0;
    for (const block of draft.blocks) {
      const group = block.kind === "detail" ? "detail" : block.kind === "clause" && block.numbered ? "clause" : "";
      count = group && group === run ? count + 1 : 1;
      run = group;
      if (group) out.set(block.id, count);
    }
    return out;
  }, [draft.blocks]);
  const hindi = language === "hindi";
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.length]);

  // Unsaved edits: the workspace is told (it asks before discarding them) and the browser asks before closing the tab.
  useEffect(() => {
    onDirtyChange?.(dirty);
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); onDirtyChange?.(false); };
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (next: EditableDraft, version: number | null) => {
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setOpened(version);
    setPast([]);
    setEditing(null);
  };

  /** Remembers the current state before a change, so Undo can return to it. */
  const checkpoint = () => setPast((current) => [...current.slice(-49), draft]);
  const undo = () => {
    const now = JSON.stringify(draft);
    let index = past.length - 1;
    while (index >= 0 && JSON.stringify(past[index]) === now) index -= 1;
    if (index >= 0) setDraft(past[index]);
    setPast(past.slice(0, Math.max(index, 0)));
    setEditing(null);
  };

  const discardIfDirty = async () => !dirty || (await confirmDialog({ title: "Discard unsaved changes?", description: "The edits you made to this draft have not been saved as a version.", confirmLabel: "Discard changes", destructive: true }));

  /** The text of a saved version; older versions are fetched the first time they are opened. */
  const contentOf = async (item: SavedDraft): Promise<EditableDraft | null> => {
    if (item.content) return item.content as EditableDraft;
    const known = fetched.current.get(item.id);
    if (known) return known;
    setOpening(true);
    try {
      const result = await loadDraftVersion({ deedId, id: item.id });
      if (result.error !== undefined) { toast.error(result.error); return null; }
      const content = result.content as EditableDraft | null;
      if (!content || !Array.isArray(content.blocks)) { toast.error("This version could not be opened."); return null; }
      fetched.current.set(item.id, content);
      return content;
    } catch {
      toast.error("This version could not be opened. Check your connection and retry.");
      return null;
    } finally { setOpening(false); }
  };

  const switchLanguage = async (next: DraftLanguage) => {
    if (next === language || !(await discardIfDirty())) return;
    const latest = saved.filter((item) => item.language === next).sort((a, b) => b.version - a.version)[0];
    const content = latest ? await contentOf(latest) : null;
    if (latest && !content) return;
    setLanguage(next);
    load(content ?? generated[next](), content && latest ? latest.version : null);
    setChat([]);
  };

  const pickVersion = async (value: string) => {
    if (!value || !(await discardIfDirty())) return;
    if (value === "generated") {
      // Shown as unsaved: review it, then Save version (Revert returns to the version that was open).
      checkpoint();
      setDraft({ ...generated[language](), basis: currentBasis });
      setEditing(null);
      return;
    }
    const version = versions.find((item) => item.id === value);
    const content = version ? await contentOf(version) : null;
    if (version && content) load(content, version.version);
  };

  const stale = Boolean(currentBasis && draft.basis && draft.basis !== currentBasis);
  const refresh = async () => {
    if (!(await confirmDialog({ title: "Rebuild this draft from the corrected details?", description: "The people, property, payment and terms are written afresh from the deed details. Text edits made in this version are replaced; the version itself stays under Versions.", confirmLabel: "Rebuild draft" }))) return;
    // Unsaved until reviewed: Undo or Revert returns to the version that was open.
    checkpoint();
    setDraft({ ...generated[language](), basis: currentBasis });
    setEditing(null);
    toast.success("Draft rebuilt from the current details", { description: "Review it, then Save version.", duration: 4000 });
  };

  const update = (id: string, text: string) => setDraft((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id && block.kind !== "locked" ? { ...block, text } : block)) }));
  const reformat = (id: string, format: Format) => { checkpoint(); setDraft((current) => ({ ...current, blocks: current.blocks.map((block) => {
    if (block.id !== id || block.kind === "locked") return block;
    const base = { id: block.id, text: block.text };
    if (format === "numbered" || format === "clause") return { ...base, kind: "clause", numbered: format === "numbered" };
    if (format === "center" || format === "para") return { ...base, kind: "para", ...(format === "center" ? { center: true } : {}) };
    return { ...base, kind: format };
  }) })); };
  const updateLocked = (id: string, locked: LockedBlock) => { checkpoint(); setDraft((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id && block.kind === "locked" ? { ...block, block: locked } : block)) })); };
  const move = (id: string, step: -1 | 1) => { checkpoint(); setDraft((current) => {
    const index = current.blocks.findIndex((block) => block.id === id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= current.blocks.length) return current;
    const blocks = [...current.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    return { ...current, blocks };
  }); };
  const remove = (id: string) => { checkpoint(); setDraft((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== id) })); };
  /** Opens a text block for editing; the state before typing is kept for Undo. */
  const startEditing = (id: string) => { checkpoint(); setEditing(id); };
  const insertAfter = (id: string) => {
    const newId = freshBlockId();
    checkpoint();
    setEditing(newId);
    setDraft((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      const target = current.blocks[index];
      const block: EditableBlock = { id: newId, kind: "clause", text: hindi ? "यह कि " : "That ", numbered: target && target.kind === "clause" ? target.numbered : false };
      const blocks = [...current.blocks];
      blocks.splice(index + 1, 0, block);
      return { ...current, blocks };
    });
  };

  const save = () =>
    startSaving(async () => {
      const note = chat.some((turn) => turn.role === "assistant" && turn.status === "applied") ? "Edited with AI assistant" : "Manual edits";
      const result = await saveDraftVersion({ deedId, draft, note });
      if (result.error || !result.draft) return void toast.error(result.error ?? "Could not save.");
      toast.success("Saved as version " + result.draft.version, { description: "Word and PDF exports use what is on screen." });
      setBaseline(JSON.stringify(draft));
      setOpened(result.draft.version);
      onSaved(result.draft);
    });

  const [teaching, startTeaching] = useTransition();
  const teach = async () => {
    if (!(await confirmDialog({ title: "Keep this draft as a style reference?", description: "Names, numbers and addresses are removed by the AI before it is stored. Future " + (hindi ? "Hindi" : "English") + " drafts of this type will follow its structure and wording. You can remove it under Settings → AI memory.", confirmLabel: "Keep as reference" }))) return;
    startTeaching(async () => {
      const text = draft.blocks.map((block) => (block.kind === "locked" ? "" : block.text.replace(/\*\*/g, ""))).filter(Boolean).join("\n\n");
      const result = await saveDraftAsReference({ deedId, language, text });
      if (result.error !== undefined) return void toast.error(result.error);
      toast.success("Saved as a style reference", { description: "Future drafts of this type will follow it." });
    });
  };

  const send = (text: string) => {
    const instruction = text.trim();
    if (!instruction || pending) return;
    const history = chat.slice(-8).map((turn) => ({ role: turn.role, content: turn.content }));
    setChat((current) => [...current, { role: "user", content: instruction }]);
    setMessage("");
    startTransition(async () => {
      const result = await chatEditDraft({ deedId, draft, message: instruction, history });
      if (result.error !== undefined) {
        setChat((current) => [...current, { role: "assistant", content: "⚠ " + result.error }]);
        return;
      }
      setChat((current) => [...current, { role: "assistant", content: result.reply, operations: result.operations, status: result.operations.length ? "pending" : undefined }]);
    });
  };

  const review = () =>
    startTransition(async () => {
      setChat((current) => [...current, { role: "user", content: hindi ? "इस मसौदे की समीक्षा करें" : "Review this draft" }]);
      const result = await reviewDraftText({ deedId, draft });
      if (result.error !== undefined) return void setChat((current) => [...current, { role: "assistant", content: "⚠ " + result.error }]);
      setChat((current) => [...current, { role: "assistant", content: result.issues.length ? "I found " + result.issues.length + " point(s) to check:" : "No issues found in the draft text.", issues: result.issues }]);
    });

  const settle = (index: number, apply: boolean, only?: EditOperation) => {
    const turn = chat[index];
    if (!turn || turn.role !== "assistant" || !turn.operations) return;
    let next: ChatTurn = { ...turn, status: "discarded" };
    if (apply) {
      const operations = only ? [only] : turn.operations;
      checkpoint();
      setDraft((doc) => applyOperations(doc, operations));
      const remaining = only ? turn.operations.filter((operation) => operation !== only) : [];
      next = { ...turn, operations: remaining, status: remaining.length ? "pending" : "applied" };
    }
    setChat((current) => current.map((item, position) => (position === index ? next : item)));
  };

  const jump = (id: string) => {
    setSheet(false);
    setHighlight(id);
    document.getElementById("block-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlight(null), 2500);
  };

  const textOf = (id: string) => {
    const block = draft.blocks.find((item) => item.id === id);
    return block && block.kind !== "locked" ? block.text : "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        {exportTitle ? <>
          <Button variant="outline" type="button" className="h-9" disabled={exporting} onClick={() => {
            setExporting(true);
            // A real .docx (A4, justified, numbered clauses, bordered tables, page numbers), built in the browser.
            void import("@/lib/drafting/docx")
              .then(({ draftToDocxBlob }) => draftToDocxBlob([fromEditable(draft)], { title: exportTitle, footer: exportTitle + " · draft for advocate review" }))
              .then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = safeFileName(exportTitle + (hindi ? " - Hindi" : " - English")) + ".docx";
                document.body.append(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
              .catch(() => toast.error("The Word file could not be created. Try Print / PDF instead."))
              .finally(() => setExporting(false));
          }}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />} Word</Button>
          <Button variant="outline" type="button" className="h-9" title="Print, or choose Save as PDF in the print dialog" onClick={() => {
            const name = exportTitle + (hindi ? " - Hindi" : " - English");
            if (!printHtml(renderDraftHtml({ title: name, documents: [fromEditable(draft)], footer: exportTitle + " · draft for advocate review" }), safeFileName(name))) toast.error("Allow pop-ups for this site to print or save as PDF.");
          }}><Printer className="size-4" /> Print / PDF</Button>
        </> : null}
        {languages.length > 1 ? (
          <div className="flex rounded-lg bg-secondary p-1 text-sm font-semibold">
            {languages.map((item) => (
              <button className={cn("rounded-md px-3 py-1", item === "hindi" && "font-devanagari", language === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground")} key={item} onClick={() => void switchLanguage(item)} type="button">
                {item === "hindi" ? "हिंदी" : "English"}
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="size-4" />
          {opening ? <LoaderCircle className="size-4 animate-spin" /> : null}
          <select aria-label="Versions" className="h-8 max-w-56 rounded-md border border-border bg-background px-2 text-sm text-foreground" disabled={opening} onChange={(event) => void pickVersion(event.target.value)} value="">
            <option value="">{versions.length ? "Versions (" + versions.length + ")" : "No saved versions"}</option>
            <option value="generated">Rebuild from the deed details</option>
            {versions.map((item) => <option key={item.id} value={item.id}>v{item.version} · {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{item.note ? " · " + item.note : ""}</option>)}
          </select>
        </label>
        <span aria-live="polite" className={cn("text-xs font-semibold", dirty ? "text-amber-700" : opened ? "text-emerald-700" : "text-muted-foreground")}>{dirty ? "Unsaved changes" : opened ? "Version " + opened + (opened === versions[0]?.version ? " · saved" : " · older version") : "Not saved yet"}</span>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {aiEnabled ? (
            <Button className="h-9 xl:hidden" onClick={() => setSheet(true)} type="button" variant="outline"><MessageSquare className="size-4" /> AI assistant</Button>
          ) : null}
          <Button aria-label="Undo the last change" className="h-9" disabled={!past.length} onClick={undo} title="Undo the last change" type="button" variant="ghost"><Undo2 className="size-4" /> Undo</Button>
          <Button className="h-9" disabled={!dirty} onClick={() => load(JSON.parse(baseline) as EditableDraft, opened)} title="Go back to the version as it was opened" type="button" variant="ghost"><RotateCcw className="size-4" /> Revert</Button>
          <Button className="h-9" disabled={saving || !dirty} onClick={save} type="button">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save version</Button>
          {aiEnabled && !dirty && versions.length ? (
            <Button className="h-9" disabled={teaching} onClick={() => void teach()} title="Keep this reviewed draft as a style reference for future drafts of this type" type="button" variant="outline">{teaching ? <LoaderCircle className="size-4 animate-spin" /> : <GraduationCap className="size-4" />} Teach AI this style</Button>
          ) : null}
        </div>
      </div>

      {stale ? <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 animate-in fade-in slide-in-from-top-1">
        <TriangleAlert className="size-4 shrink-0 text-amber-700" />
        <p className="min-w-0 flex-1">The deed details were corrected after this version was prepared. Rebuild it so the people, property and payment details match.</p>
        <div className="flex flex-wrap gap-2">
          {onEditDetails ? <Button type="button" variant="outline" className="h-8 bg-white" onClick={onEditDetails}><Pencil className="size-3.5" /> Review details</Button> : null}
          <Button type="button" className="h-8" onClick={() => void refresh()}><RefreshCw className="size-3.5" /> Rebuild from details</Button>
        </div>
      </div> : null}

      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", aiEnabled && "xl:grid-cols-[minmax(0,1fr)_400px]")}>
        <section className="min-w-0 rounded-xl border border-border bg-white p-3 shadow-sm sm:p-6">
          <p className="mb-3 rounded-md bg-secondary/60 px-3 py-2 text-xs leading-5 text-muted-foreground">Click or tap any paragraph, table or signature block to edit it; use the small toolbar to move, add or remove parts. **Double asterisks** make text bold.{onEditDetails ? <> To correct a name, amount or boundary everywhere, <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={onEditDetails}>edit the details</button> and rebuild.</> : null}</p>
          <div className={cn("space-y-1 text-[15px] text-neutral-900", hindi ? "font-devanagari" : "font-serif")}>
            {draft.blocks.map((block, position) => {
              const tools = <BlockTools first={position === 0} last={position === draft.blocks.length - 1} onUp={() => move(block.id, -1)} onDown={() => move(block.id, 1)} onInsert={() => insertAfter(block.id)} onDelete={() => remove(block.id)} onEdit={block.kind === "locked" && block.block.t !== "pagebreak" ? () => setEditing(block.id) : undefined} format={block.kind === "locked" ? null : formatOf(block)} onFormat={(format) => reformat(block.id, format)} />;
              if (block.kind === "locked") {
                return <div className={cn("group relative rounded-md", highlight === block.id && "ring-2 ring-accent")} id={"block-" + block.id} key={block.id}>
                  {editing === block.id && block.block.t !== "pagebreak" ? <LockedEditor block={block.block} hindi={hindi} onCancel={() => setEditing(null)} onSave={(next) => { updateLocked(block.id, next); setEditing(null); }} /> : <>
                    <div aria-label={block.block.t === "pagebreak" ? "Page break" : "Edit " + (block.block.t === "signatures" ? "signature blocks" : "table")} className={cn("draft-locked rounded-md border border-dashed border-transparent p-2 text-sm outline-none transition hover:border-border hover:bg-secondary/20 focus-visible:border-primary [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-100 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:align-top [&_.label]:font-semibold [&_.side]:font-semibold [&_.signs]:flex [&_.signs]:flex-wrap [&_.signs]:gap-6 [&_.sign]:min-w-48 [&_.sign]:flex-1 [&_.line]:mb-1 [&_.line]:h-10 [&_.line]:border-b [&_.line]:border-dotted [&_.line]:border-neutral-500 [&_.pagebreak]:border-t [&_.pagebreak]:border-dashed [&_.pagebreak]:border-neutral-300", block.block.t !== "pagebreak" && "cursor-pointer")} dangerouslySetInnerHTML={{ __html: renderBlock(lockedToBlock(block.block)) }} onClick={block.block.t !== "pagebreak" ? () => setEditing(block.id) : undefined} onKeyDown={(event) => { if (block.block.t !== "pagebreak" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setEditing(block.id); } }} role={block.block.t !== "pagebreak" ? "button" : undefined} tabIndex={0} />
                    {tools}
                  </>}
                </div>;
              }
              const number = numbers.get(block.id);
              const style = cn(kindStyles[block.kind], block.center && "text-center", block.kind === "clause" && !block.numbered && (hindi ? "indent-10" : "indent-8"), number !== undefined && "pl-9");
              return <div className={cn("group relative rounded-md", highlight === block.id && "bg-accent/15 ring-2 ring-accent")} id={"block-" + block.id} key={block.id}>
                <span className="sr-only">{kindLabels[block.kind]}</span>
                {number !== undefined ? <span aria-hidden="true" className={cn("pointer-events-none absolute left-2 top-1.5 w-6 select-none text-right leading-7 tabular-nums", block.kind === "detail" && "text-sm")}>{number}.</span> : null}
                {editing === block.id ? <AutoText className={style} hindi={hindi} onChange={(value) => update(block.id, value)} onDone={() => setEditing(null)} value={block.text} /> : <BlockText className={style} hindi={hindi} onEdit={() => startEditing(block.id)} value={block.text} />}
                {tools}
              </div>;
            })}
          </div>
        </section>

        {aiEnabled && sheet ? <button aria-label="Close assistant" className="fixed inset-0 z-40 bg-primary/40 duration-200 animate-in fade-in xl:hidden" onClick={() => setSheet(false)} type="button" /> : null}
        {aiEnabled ? (
          <aside aria-label="Drafting assistant" className={cn("flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:sticky xl:top-20 xl:z-auto xl:flex xl:max-h-[calc(100dvh-6rem)]", sheet ? "fixed inset-x-2 bottom-2 z-50 flex h-[80dvh] shadow-2xl duration-200 animate-in fade-in slide-in-from-bottom-8 xl:static xl:h-auto xl:animate-none" : "hidden")}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="flex items-center gap-2 font-semibold text-primary"><Bot className="size-4 text-accent-foreground" /> Drafting assistant</p>
              <div className="flex items-center gap-1">
                <Button className="h-8" disabled={pending} onClick={review} type="button" variant="outline"><ShieldCheck className="size-4" /> Review</Button>
                <Button aria-label="Close assistant" className="h-8 xl:hidden" onClick={() => setSheet(false)} type="button" variant="ghost"><X className="size-4" /></Button>
              </div>
            </div>
            <div className="min-h-64 flex-1 space-y-3 overflow-y-auto p-4">
              {!chat.length ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Tell me what to change in plain words, in Hindi or English. I will propose exact edits for you to apply.</p>
                  {(hindi
                    ? ["कब्जा पंजीयन के समय दिया जायेगा, यह जोड़ें", "बकाया बिजली व पानी के बिल विक्रेता चुकायेगा — धारा जोड़ें", "भाषा को और औपचारिक बनायें"]
                    : ["Possession will be handed over at registration", "Add a clause that the seller clears pending electricity and water bills", "Make the language more formal"]
                  ).map((prompt) => (
                    <button className={cn("block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground hover:bg-secondary", hindi && "font-devanagari")} key={prompt} onClick={() => send(prompt)} type="button">{prompt}</button>
                  ))}
                </div>
              ) : null}
              {chat.map((turn, index) =>
                turn.role === "user" ? (
                  <div className="appear ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" key={index}>{turn.content}</div>
                ) : (
                  <div className="appear mr-4 space-y-2 rounded-lg bg-secondary/70 px-3 py-2 text-sm" key={index}>
                    <p className="whitespace-pre-wrap">{turn.content}</p>
                    {turn.issues?.length ? (
                      <ul className="space-y-1.5">
                        {turn.issues.map((issue, position) => (
                          <li key={position} className="flex items-start gap-1 rounded-md bg-card p-1 text-xs">
                            <button className="min-w-0 flex-1 rounded p-1 text-left hover:bg-secondary/60" onClick={() => draft.blocks.some((block) => block.id === issue.section) && jump(issue.section)} type="button">
                              <span className={cn("mr-1.5 rounded px-1.5 py-0.5 font-bold uppercase", issue.severity === "high" ? "bg-red-50 text-red-700" : issue.severity === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700")}>{issue.severity}</span>
                              {issue.message}
                            </button>
                            <button className="shrink-0 rounded px-2 py-1 font-semibold text-primary hover:bg-primary/10 disabled:opacity-40" disabled={pending} onClick={() => send((draft.blocks.some((block) => block.id === issue.section) ? "In block " + issue.section + ": " : "") + "fix this — " + issue.message)} title="Ask the assistant to propose a fix" type="button"><Wand2 className="mr-1 inline size-3" />Fix</button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {turn.operations?.length && turn.status === "pending" ? (
                      <div className="space-y-2">
                        {turn.operations.map((operation, position) => (
                          <div className="rounded-md border border-border bg-card p-2 text-xs" key={position}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <button className="font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary" onClick={() => jump(operation.id)} type="button">
                                {operation.op === "replace" ? "Change" : operation.op === "delete" ? "Remove" : "Add after"} · {operation.id}
                              </button>
                              <button className="font-semibold text-primary hover:underline" onClick={() => settle(index, true, operation)} type="button">Apply</button>
                            </div>
                            {operation.warning ? <p className="mb-1 flex items-start gap-1 rounded bg-amber-50 px-2 py-1 font-medium text-amber-900"><TriangleAlert className="mt-0.5 size-3 shrink-0" />{operation.warning}</p> : null}
                            {operation.op !== "insert_after" ? <p className={cn("rounded bg-red-50 px-2 py-1 text-red-900 line-through decoration-red-400", hindi && "font-devanagari")}>{textOf(operation.id).slice(0, 400)}</p> : null}
                            {operation.op !== "delete" ? <p className={cn("mt-1 rounded bg-emerald-50 px-2 py-1 text-emerald-900", hindi && "font-devanagari")}>{operation.text}</p> : null}
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button className="h-8" onClick={() => settle(index, true)} type="button"><Check className="size-4" /> Apply all</Button>
                          <Button className="h-8" onClick={() => settle(index, false)} type="button" variant="ghost"><X className="size-4" /> Discard</Button>
                        </div>
                      </div>
                    ) : null}
                    {turn.status === "applied" ? <p className="text-xs font-semibold text-emerald-700">Applied — remember to save the version.</p> : null}
                    {turn.status === "discarded" ? <p className="text-xs text-muted-foreground">Discarded.</p> : null}
                  </div>
                ),
              )}
              {pending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Reading the whole draft and working out the changes… this can take up to a minute.</p> : null}
              <div ref={chatEnd} />
            </div>
            <form
              className="flex items-end gap-2 border-t border-border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                send(message);
              }}
            >
              <textarea
                className={cn("max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary", hindi && "font-devanagari")}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(message);
                  }
                }}
                placeholder={hindi ? "क्या बदलना है? (Enter से भेजें)" : "What should change? (Enter to send)"}
                rows={1}
                value={message}
              />
              <Button aria-label="Send" className="h-10" disabled={pending || message.trim().length < 2} type="submit"><Send className="size-4" /></Button>
            </form>
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">Identity numbers are not sent to the AI. Review every change.</p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
