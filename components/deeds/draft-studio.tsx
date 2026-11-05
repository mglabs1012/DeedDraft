"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bot, Check, FileDown, GraduationCap, History, Lock, LoaderCircle, MessageSquare, Plus, Printer, RotateCcw, Save, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { chatEditDraft, reviewDraftText } from "@/app/actions/ai";
import { saveDraftVersion, type SavedDraft } from "@/app/actions/drafts";
import { saveDraftAsReference } from "@/app/actions/memory";
import { Button } from "@/components/ui/button";
import type { ReviewIssue } from "@/lib/ai/parse";
import type { DraftLanguage } from "@/lib/deed-types";
import { renderBlock, renderDraftHtml } from "@/lib/drafting/blocks";
import { safeFileName } from "@/lib/drafting/transliterate";
import { applyOperations, fromEditable, markupToHtml, type EditableBlock, type EditableDraft, type EditOperation, type TextKind } from "@/lib/drafting/editable";
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

export function DraftStudio({
  deedId,
  languages,
  generated,
  saved,
  aiEnabled,
  onSaved,
  exportTitle,
}: {
  deedId: string;
  languages: DraftLanguage[];
  generated: Record<DraftLanguage, () => EditableDraft>;
  saved: SavedDraft[];
  aiEnabled: boolean;
  onSaved: (draft: SavedDraft) => void;
  exportTitle?: string;
}) {
  const [language, setLanguage] = useState<DraftLanguage>(languages[0]);
  const versions = useMemo(() => saved.filter((item) => item.language === language).sort((a, b) => b.version - a.version), [saved, language]);
  const [draft, setDraft] = useState<EditableDraft>(() => (versions[0]?.content as EditableDraft | undefined) ?? generated[language]());
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(draft));
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [message, setMessage] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // Narrow screens: the assistant opens as a bottom sheet; wide screens always show it beside the draft.
  const [sheet, setSheet] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(draft) !== baseline;
  const hindi = language === "hindi";
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.length]);

  const load = (next: EditableDraft) => {
    setDraft(next);
    setBaseline(JSON.stringify(next));
  };

  const switchLanguage = (next: DraftLanguage) => {
    if (dirty && !window.confirm("Discard unsaved changes to this draft?")) return;
    setLanguage(next);
    const latest = saved.filter((item) => item.language === next).sort((a, b) => b.version - a.version)[0];
    load((latest?.content as EditableDraft | undefined) ?? generated[next]());
    setChat([]);
  };

  const pickVersion = (value: string) => {
    if (dirty && !window.confirm("Discard unsaved changes to this draft?")) return;
    if (value === "generated") return load(generated[language]());
    const version = versions.find((item) => item.id === value);
    if (version) load(version.content as EditableDraft);
  };

  const update = (id: string, text: string) => setDraft((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id && block.kind !== "locked" ? { ...block, text } : block)) }));
  const remove = (id: string) => setDraft((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== id) }));
  const insertAfter = (id: string) => {
    const newId = "u" + Date.now().toString(36);
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
      toast.success("Saved as version " + result.draft.version + ". Exports now use this version.");
      setBaseline(JSON.stringify(draft));
      onSaved(result.draft);
    });

  const [teaching, startTeaching] = useTransition();
  const teach = () => {
    if (!window.confirm("Keep this draft as a style reference? Names, numbers and addresses are removed by the AI before it is stored, and future " + (hindi ? "Hindi" : "English") + " drafts of this type will follow its structure and wording. You can remove it under Settings → AI memory.")) return;
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
          <Button variant="outline" type="button" className="h-9" onClick={() => {
            const win = window.open("", "_blank");
            if (!win) return toast.error("Allow pop-ups to print or save as PDF.");
            win.document.write(renderDraftHtml({ title: exportTitle, documents: [fromEditable(draft)], footer: "Draft for review" }));
            win.document.close(); win.focus(); win.setTimeout(() => win.print(), 300);
          }}><Printer className="size-4" /> Print / PDF</Button>
        </> : null}
        {languages.length > 1 ? (
          <div className="flex rounded-lg bg-secondary p-1 text-sm font-semibold">
            {languages.map((item) => (
              <button className={cn("rounded-md px-3 py-1", item === "hindi" && "font-devanagari", language === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground")} key={item} onClick={() => switchLanguage(item)} type="button">
                {item === "hindi" ? "हिंदी" : "English"}
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="size-4" />
          <select className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground" onChange={(event) => pickVersion(event.target.value)} value="">
            <option value="">{versions.length ? "Versions (" + versions.length + ")" : "No saved versions"}</option>
            <option value="generated">Regenerate from matter data</option>
            {versions.map((item) => <option key={item.id} value={item.id}>v{item.version} · {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{item.note ? " · " + item.note : ""}</option>)}
          </select>
        </label>
        <span className={cn("text-xs font-semibold", dirty ? "text-amber-700" : "text-emerald-700")}>{dirty ? "Unsaved changes" : versions.length ? "Saved (v" + versions[0].version + ")" : "Generated draft"}</span>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {aiEnabled ? (
            <Button className="h-9 xl:hidden" onClick={() => setSheet(true)} type="button" variant="outline"><MessageSquare className="size-4" /> AI assistant</Button>
          ) : null}
          <Button className="h-9" disabled={!dirty} onClick={() => load(JSON.parse(baseline) as EditableDraft)} type="button" variant="ghost"><RotateCcw className="size-4" /> Undo all</Button>
          <Button className="h-9" disabled={saving || !dirty} onClick={save} type="button">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save version</Button>
          {aiEnabled && !dirty && versions.length ? (
            <Button className="h-9" disabled={teaching} onClick={teach} title="Keep this reviewed draft as a style reference for future drafts of this type" type="button" variant="outline">{teaching ? <LoaderCircle className="size-4 animate-spin" /> : <GraduationCap className="size-4" />} Teach AI this style</Button>
          ) : null}
        </div>
      </div>

      <div className={cn("grid gap-4", aiEnabled && "xl:grid-cols-[minmax(0,1fr)_400px]")}>
        <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-6">
          <p className="mb-3 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">Click or tap any paragraph to edit it. Boundaries, tables and signatures come from the matter details. In the editor, **double asterisks** make text bold.</p>
          <div className={cn("space-y-1 text-[15px] text-neutral-900", hindi ? "font-devanagari" : "font-serif")}>
            {draft.blocks.map((block) =>
              block.kind === "locked" ? (
                <div className={cn("group relative rounded-md border border-dashed border-transparent p-2 hover:border-border", highlight === block.id && "ring-2 ring-accent")} id={"block-" + block.id} key={block.id}>
                  <span className="absolute right-2 top-2 hidden items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground group-hover:flex"><Lock className="size-3" /> From matter data</span>
                  <div className="draft-locked text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-100 [&_th]:px-2 [&_th]:py-1 [&_.signs]:flex [&_.signs]:flex-wrap [&_.signs]:gap-6 [&_.sign]:min-w-48 [&_.sign]:flex-1 [&_.line]:mb-1 [&_.line]:h-10 [&_.line]:border-b [&_.line]:border-dotted [&_.line]:border-neutral-500" dangerouslySetInnerHTML={{ __html: renderBlock(block.block) }} />
                </div>
              ) : (
                <div className={cn("group relative flex gap-1 rounded-md", highlight === block.id && "bg-accent/15 ring-2 ring-accent")} id={"block-" + block.id} key={block.id}>
                  <div className="min-w-0 flex-1">
                    {editing === block.id ? <AutoText className={cn(kindStyles[block.kind], block.center && "text-center", block.kind === "clause" && !block.numbered && (hindi ? "indent-10" : "indent-8"), block.kind === "clause" && block.numbered && "pl-6")} hindi={hindi} onChange={(value) => update(block.id, value)} onDone={() => setEditing(null)} value={block.text} /> : <BlockText className={cn(kindStyles[block.kind], block.center && "text-center", block.kind === "clause" && !block.numbered && (hindi ? "indent-10" : "indent-8"), block.kind === "clause" && block.numbered && "pl-6")} hindi={hindi} onEdit={() => setEditing(block.id)} value={block.text} />}
                  </div>
                  <div className="invisible flex shrink-0 flex-col gap-0.5 pt-1 group-focus-within:visible group-hover:visible">
                    <span className="sr-only">{kindLabels[block.kind]}</span>
                    <button aria-label="Insert clause below" className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary" onClick={() => insertAfter(block.id)} title="Insert clause below" type="button"><Plus className="size-3.5" /></button>
                    <button aria-label="Delete block" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(block.id)} title="Delete" type="button"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        {aiEnabled && sheet ? <button aria-label="Close assistant" className="fixed inset-0 z-40 bg-primary/40 xl:hidden" onClick={() => setSheet(false)} type="button" /> : null}
        {aiEnabled ? (
          <aside aria-label="Drafting assistant" className={cn("flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:sticky xl:top-20 xl:z-auto xl:flex xl:max-h-[calc(100dvh-6rem)]", sheet ? "fixed inset-x-2 bottom-2 z-50 flex h-[80dvh] shadow-2xl xl:static xl:h-auto" : "hidden")}>
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
                  <div className="ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" key={index}>{turn.content}</div>
                ) : (
                  <div className="mr-4 space-y-2 rounded-lg bg-secondary/70 px-3 py-2 text-sm" key={index}>
                    <p className="whitespace-pre-wrap">{turn.content}</p>
                    {turn.issues?.length ? (
                      <ul className="space-y-1.5">
                        {turn.issues.map((issue, position) => (
                          <li key={position}>
                            <button className="w-full rounded-md bg-card p-2 text-left text-xs hover:ring-1 hover:ring-primary/30" onClick={() => draft.blocks.some((block) => block.id === issue.section) && jump(issue.section)} type="button">
                              <span className={cn("mr-1.5 rounded px-1.5 py-0.5 font-bold uppercase", issue.severity === "high" ? "bg-red-50 text-red-700" : issue.severity === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700")}>{issue.severity}</span>
                              {issue.message}
                            </button>
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
              {pending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Thinking…</p> : null}
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
