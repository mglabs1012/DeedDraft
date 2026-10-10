"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, BookOpen, Brain, Eye, FileUp, LoaderCircle, Pencil, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { deleteMemory, getMemoryContent, learnStyle, pasteReference, saveNote, setMemoryEnabled, uploadReference, type BuiltInItem, type MemoryItem } from "@/app/actions/memory";
import { Button } from "@/components/ui/button";
import { inputClass, textareaClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { deedTypes, type DeedType } from "@/lib/deed-types";
import { coreOrder } from "@/lib/templates/catalog";
import { cn } from "@/lib/utils";

const typeLabel = (type: DeedType | null) => (type ? deedTypes[type].label : "All deeds");
const sourceLabel: Record<MemoryItem["source"], string> = { manual: "Added by you", upload: "Uploaded", finalized: "From a finished deed", ai: "Learned by AI", chat: "From chat" };
const card = "rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6";

function TypeSelect({ value, onChange, allowAll = true, className }: { value: DeedType | ""; onChange: (value: DeedType | "") => void; allowAll?: boolean; className?: string }) {
  return (
    <select className={cn(inputClass, className)} onChange={(event) => onChange(event.target.value as DeedType | "")} value={value}>
      {allowAll ? <option value="">All deeds</option> : null}
      {coreOrder.map((type) => <option key={type} value={type}>{deedTypes[type].label}</option>)}
    </select>
  );
}

export function AiMemoryManager({ available, aiEnabled, notes: initialNotes, references: initialReferences, builtIns }: { available: boolean; aiEnabled: boolean; notes: MemoryItem[]; references: MemoryItem[]; builtIns: BuiltInItem[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [references, setReferences] = useState(initialReferences);
  const [view, setView] = useState<{ title: string; content: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (item: MemoryItem, enabled: boolean, list: "notes" | "references") =>
    startTransition(async () => {
      const result = await setMemoryEnabled({ id: item.id, enabled });
      if (result.error !== undefined) return void toast.error(result.error);
      const update = (items: MemoryItem[]) => items.map((row) => (row.id === item.id ? { ...row, enabled } : row));
      if (list === "notes") setNotes(update);
      else setReferences(update);
    });

  const remove = (item: MemoryItem, list: "notes" | "references") =>
    startTransition(async () => {
      const result = await deleteMemory({ id: item.id });
      if (result.error !== undefined) return void toast.error(result.error);
      if (list === "notes") setNotes((items) => items.filter((row) => row.id !== item.id));
      else setReferences((items) => items.filter((row) => row.id !== item.id));
      toast.success("Removed from AI memory.");
    });

  const open = (id: string) =>
    startTransition(async () => {
      const result = await getMemoryContent({ id });
      if (result.error !== undefined) return void toast.error(result.error);
      setView(result);
    });

  return (
    <div className="space-y-6">
      {!available ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>AI memory needs one database update. Run <span className="font-mono">supabase/migrations/202610100004_ai_memory.sql</span> in the Supabase SQL editor, then reload this page. Until then the AI uses the built-in reference deeds only.</p>
        </div>
      ) : null}
      {!aiEnabled ? <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">AI is not set up, so uploads cannot be read yet. Add the AWS settings to .env.local.</p> : null}

      <NotesSection disabled={!available} notes={notes} onRemove={(item) => remove(item, "notes")} onSaved={setNotes} onToggle={(item, enabled) => toggle(item, enabled, "notes")} pending={pending} />

      <LearnSection disabled={!available || !aiEnabled} onSaved={(added) => setNotes((items) => [...added, ...items])} />

      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary"><BookOpen className="size-5 text-accent-foreground" /> Accepted drafts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload deeds that were accepted for registration. The AI reads them (including scans and Kruti Dev PDFs), removes names and numbers, and follows their format, clause order and wording for new drafts of the same type.</p>
        <UploadReference disabled={!available || !aiEnabled} onAdded={(item) => setReferences((items) => [item, ...items])} />
        <ul className="mt-5 divide-y divide-border rounded-lg border border-border">
          {references.length ? references.map((item) => (
            <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center" key={item.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary">{item.title || "Accepted draft"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{typeLabel(item.deed_type)} · {item.language === "english" ? "English" : "हिंदी"} · {sourceLabel[item.source]} · {Math.round(item.length / 1000)}k characters</p>
              </div>
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground"><input checked={item.enabled} className="size-4 accent-[var(--primary)]" onChange={(event) => toggle(item, event.target.checked, "references")} type="checkbox" /> In use</label>
                <button aria-label="View" className="rounded-md p-2 text-primary hover:bg-secondary" onClick={() => open(item.id)} type="button"><Eye className="size-4" /></button>
                <button aria-label="Delete" className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(item, "references")} type="button"><Trash2 className="size-4" /></button>
              </div>
            </li>
          )) : <li className="p-4 text-sm text-muted-foreground">No accepted drafts yet. Until you add some, the AI follows the built-in references below.</li>}
        </ul>
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-semibold text-primary">Built-in references ({builtIns.length}) — real registered Rajasthan deeds, anonymised</summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {builtIns.map((item) => (
              <li key={item.id}>
                <button className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-3 text-left hover:bg-secondary" onClick={() => open(item.id)} type="button">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-primary">{item.title}</span><span className="text-xs text-muted-foreground">{deedTypes[item.deedType].label} · {item.language === "english" ? "English" : "हिंदी"}</span></span>
                  <Eye className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <Modal className="sm:max-w-3xl" onClose={() => setView(null)} open={view !== null} title={view?.title ?? ""}>
        <div className="whitespace-pre-wrap break-words font-serif text-[15px] leading-7">{view?.content}</div>
      </Modal>
    </div>
  );
}

function NotesSection({ notes, disabled, pending, onSaved, onToggle, onRemove }: { notes: MemoryItem[]; disabled: boolean; pending: boolean; onSaved: (notes: MemoryItem[]) => void; onToggle: (item: MemoryItem, enabled: boolean) => void; onRemove: (item: MemoryItem) => void }) {
  const [text, setText] = useState("");
  const [type, setType] = useState<DeedType | "">("");
  const [editing, setEditing] = useState<{ id: string; text: string; type: DeedType | "" } | null>(null);
  const [saving, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await saveNote({ content: text, deedType: type || null });
      if (result.error !== undefined) return void toast.error(result.error);
      onSaved([{ id: crypto.randomUUID(), kind: "note", deed_type: type || null, language: null, title: "", source: "manual", enabled: true, created_at: new Date().toISOString(), preview: text.trim(), length: text.trim().length }, ...notes]);
      setText("");
      toast.success("The AI will follow this from now on.");
    });

  const update = () =>
    startTransition(async () => {
      if (!editing) return;
      const result = await saveNote({ id: editing.id, content: editing.text, deedType: editing.type || null });
      if (result.error !== undefined) return void toast.error(result.error);
      onSaved(notes.map((note) => (note.id === editing.id ? { ...note, preview: editing.text.trim(), deed_type: editing.type || null } : note)));
      setEditing(null);
    });

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-primary"><Brain className="size-5 text-accent-foreground" /> Drafting instructions</h2>
      <p className="mt-1 text-sm text-muted-foreground">Standing rules the AI follows in every draft, review and chat — like telling a junior how your office drafts.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <textarea className={textareaClass + " min-h-20 text-base sm:text-sm"} disabled={disabled} onChange={(event) => setText(event.target.value)} placeholder="e.g. Always write the sale consideration as “रूपये … अक्षरे … मात्र”; mention possession “बरोज पंजीयन”." value={text} />
        <div className="flex flex-col gap-2">
          <TypeSelect onChange={setType} value={type} />
          <Button className="h-10" disabled={disabled || saving || text.trim().length < 3} onClick={add} type="button">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Add</Button>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {notes.map((note) => (
          <li className={cn("rounded-lg border border-border p-3", !note.enabled && "opacity-60")} key={note.id}>
            {editing?.id === note.id ? (
              <div className="space-y-2">
                <textarea className={textareaClass + " min-h-16"} onChange={(event) => setEditing({ ...editing, text: event.target.value })} value={editing.text} />
                <div className="flex flex-wrap gap-2">
                  <TypeSelect className="h-9 w-auto" onChange={(value) => setEditing({ ...editing, type: value })} value={editing.type} />
                  <Button className="h-9" disabled={saving} onClick={update} type="button"><Save className="size-4" /> Save</Button>
                  <Button className="h-9" onClick={() => setEditing(null)} type="button" variant="ghost"><X className="size-4" /> Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm">{note.preview}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{typeLabel(note.deed_type)} · {sourceLabel[note.source]}</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input checked={note.enabled} className="size-4 accent-[var(--primary)]" disabled={pending} onChange={(event) => onToggle(note, event.target.checked)} type="checkbox" /> On</label>
                <button aria-label="Edit" className="rounded-md p-1.5 text-primary hover:bg-secondary" onClick={() => setEditing({ id: note.id, text: note.preview, type: note.deed_type ?? "" })} type="button"><Pencil className="size-4" /></button>
                <button aria-label="Delete" className="rounded-md p-1.5 text-muted-foreground hover:text-destructive" onClick={() => onRemove(note)} type="button"><Trash2 className="size-4" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LearnSection({ disabled, onSaved }: { disabled: boolean; onSaved: (items: MemoryItem[]) => void }) {
  const [type, setType] = useState<DeedType | "">("sale");
  const [suggestions, setSuggestions] = useState<Array<{ text: string; keep: boolean }>>([]);
  const [working, startTransition] = useTransition();

  const analyse = () =>
    startTransition(async () => {
      if (!type) return;
      const result = await learnStyle({ deedType: type });
      if (result.error !== undefined) return void toast.error(result.error);
      setSuggestions(result.suggestions.map((text) => ({ text, keep: true })));
    });

  const save = () =>
    startTransition(async () => {
      const kept = suggestions.filter((item) => item.keep && item.text.trim());
      const added: MemoryItem[] = [];
      for (const item of kept) {
        const result = await saveNote({ content: item.text, deedType: type || null, source: "ai" });
        if (result.error !== undefined) return void toast.error(result.error);
        added.push({ id: crypto.randomUUID(), kind: "note", deed_type: type || null, language: null, title: "", source: "ai", enabled: true, created_at: new Date().toISOString(), preview: item.text, length: item.text.length });
      }
      onSaved(added);
      setSuggestions([]);
      toast.success(added.length + " instructions saved.");
    });

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-primary"><Sparkles className="size-5 text-accent-foreground" /> Learn my style</h2>
      <p className="mt-1 text-sm text-muted-foreground">The AI studies your accepted drafts of one type and writes down your style as instructions. Review them before saving.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <TypeSelect allowAll={false} className="sm:w-60" onChange={setType} value={type} />
        <Button className="h-10" disabled={disabled || working || !type} onClick={analyse} type="button">{working ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Analyse drafts</Button>
      </div>
      {suggestions.length ? (
        <div className="mt-4 space-y-2">
          {suggestions.map((item, index) => (
            <div className="flex items-start gap-2" key={index}>
              <input checked={item.keep} className="mt-3 size-4 accent-[var(--primary)]" onChange={(event) => setSuggestions((list) => list.map((row, i) => (i === index ? { ...row, keep: event.target.checked } : row)))} type="checkbox" />
              <textarea className={textareaClass + " min-h-12 py-2 text-sm"} onChange={(event) => setSuggestions((list) => list.map((row, i) => (i === index ? { ...row, text: event.target.value } : row)))} value={item.text} />
            </div>
          ))}
          <Button className="h-10" disabled={working} onClick={save} type="button"><Save className="size-4" /> Save selected as instructions</Button>
        </div>
      ) : null}
    </section>
  );
}

function UploadReference({ disabled, onAdded }: { disabled: boolean; onAdded: (item: MemoryItem) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DeedType | "">("");
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [working, setWorking] = useState(false);

  const upload = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return void toast.error("The file must be under 20 MB.");
    const form = new FormData();
    form.append("file", file);
    if (type) form.append("deedType", type);
    setWorking(true);
    const toastId = toast.loading("Reading " + file.name + "… this takes about a minute.");
    void uploadReference(form)
      .then((result) => {
        if (result.error !== undefined) return toast.error(result.error, { id: toastId });
        onAdded(result.item);
        toast.success("Added: " + result.item.title, { id: toastId });
      })
      .catch(() => toast.error("Upload failed. Please try again.", { id: toastId }))
      .finally(() => setWorking(false));
  };

  const savePaste = () => {
    setWorking(true);
    const toastId = toast.loading("Reading the text…");
    void pasteReference({ text: paste, deedType: type || undefined })
      .then((result) => {
        if (result.error !== undefined) return toast.error(result.error, { id: toastId });
        onAdded(result.item);
        setPaste("");
        setShowPaste(false);
        toast.success("Added: " + result.item.title, { id: toastId });
      })
      .finally(() => setWorking(false));
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <TypeSelect className="sm:w-60" onChange={setType} value={type} />
        <Button className="h-10" disabled={disabled || working} onClick={() => input.current?.click()} type="button">{working ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />} Upload accepted draft</Button>
        <Button className="h-10" disabled={disabled || working} onClick={() => setShowPaste((value) => !value)} type="button" variant="outline">Paste text</Button>
        <input accept=".pdf,.docx,image/jpeg,image/png" className="hidden" onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} ref={input} type="file" />
      </div>
      <p className="text-xs text-muted-foreground">Leave the type on “All deeds” to let the AI detect it. PDF, Word (.docx), JPG or PNG, up to 20 MB.</p>
      {showPaste ? (
        <div className="space-y-2">
          <textarea className={textareaClass + " min-h-40"} onChange={(event) => setPaste(event.target.value)} placeholder="Paste the full text of an accepted deed…" value={paste} />
          <Button className="h-10" disabled={working || paste.trim().length < 300} onClick={savePaste} type="button"><Save className="size-4" /> Add to memory</Button>
        </div>
      ) : null}
    </div>
  );
}
