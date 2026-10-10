"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileDown, LoaderCircle, Pencil, Printer, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { draftFromTemplate, saveCustomAnswers, saveCustomDraft } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import type { DeedLanguage } from "@/lib/deeds";
import type { CustomDoc, CustomDraft } from "@/lib/schemas/deed-data";
import type { LibraryEntry } from "@/lib/templates/catalog";
import { formFor, type FormField } from "@/lib/templates/forms";
import { customDraftHtml, draftToText, templateAsDraft, textToParagraphs } from "@/lib/templates/render";
import { cn } from "@/lib/utils";

type Lang = "english" | "hindi";
const langLabels: Record<Lang, string> = { english: "English", hindi: "हिंदी" };

export const languagesFor = (language: DeedLanguage): Lang[] => (language === "bilingual" ? ["hindi", "english"] : [language]);

export function missingRequired(entry: LibraryEntry, answers: Record<string, string>) {
  return formFor(entry).flatMap((section) => section.fields.filter((item) => item.required && !answers[item.key]?.trim()).map((item) => section.title + ": " + item.label));
}

/* ------------------------------------------------------------- Details form */

export function CustomDetailsForm({ deedId, entry, custom, onSaved, onNext }: { deedId: string; entry: LibraryEntry; custom: CustomDoc; onSaved: (answers: Record<string, string>) => void; onNext: () => void }) {
  const sections = useMemo(() => formFor(entry), [entry]);
  const [answers, setAnswers] = useState<Record<string, string>>(custom.answers);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const required = sections.flatMap((section) => section.fields).filter((item) => item.required);
  const filledRequired = required.filter((item) => answers[item.key]?.trim()).length;

  const set = (key: string, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const save = (thenNext = false) =>
    startTransition(async () => {
      const result = await saveCustomAnswers({ id: deedId, answers });
      if (result.error !== undefined) return void toast.error(result.error);
      setDirty(false);
      onSaved(answers);
      toast.success("Details saved.");
      if (thenNext) onNext();
    });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-semibold text-primary">Fill in the details</h2>
        <p className="mt-1 text-sm text-muted-foreground">Answer in simple words. Leave anything you don&apos;t know blank — it stays as a blank line in the draft to fill by hand.</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all" style={{ width: (required.length ? (filledRequired / required.length) * 100 : 100) + "%" }} /></div>
          <span className="shrink-0 text-xs font-semibold text-primary">{filledRequired}/{required.length} required</span>
        </div>
      </div>

      {sections.map((section) => (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5" key={section.title}>
          <h3 className="font-semibold text-primary">{section.title}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {section.fields.map((item) => <AnswerField item={item} key={item.key} onChange={(value) => set(item.key, value)} value={answers[item.key] ?? ""} />)}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-col gap-2 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <Button className="h-11 sm:h-10" disabled={pending || !dirty} onClick={() => save()} type="button" variant="outline">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </Button>
        <Button className="h-11 sm:h-10" disabled={pending} onClick={() => (dirty ? save(true) : onNext())} type="button">
          {dirty ? "Save and continue" : "Continue to draft"} <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AnswerField({ item, value, onChange }: { item: FormField; value: string; onChange: (value: string) => void }) {
  const label = item.label + (item.required ? " *" : "");
  const common = { "aria-required": item.required, placeholder: item.placeholder, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return (
    <Field className={item.type === "textarea" ? "sm:col-span-2" : undefined} hint={item.hint} label={label}>
      {item.type === "textarea" ? (
        <textarea className={textareaClass + " min-h-20 text-base sm:text-sm"} {...common} />
      ) : (
        <input
          className={inputClass + " text-base sm:text-sm"}
          inputMode={item.type === "money" || item.type === "number" ? "decimal" : undefined}
          type={item.type === "date" ? "date" : "text"}
          {...common}
          placeholder={item.type === "money" ? item.placeholder ?? "e.g. 1,50,000" : item.placeholder}
        />
      )}
    </Field>
  );
}

/* --------------------------------------------------------------- Draft panel */

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

export function CustomDraftPanel({
  deedId,
  entry,
  custom,
  templateText,
  language,
  title,
  referenceNo,
  footer,
  aiEnabled,
  onDraft,
  onEditDetails,
}: {
  deedId: string;
  entry: LibraryEntry;
  custom: CustomDoc;
  templateText: string;
  language: DeedLanguage;
  title: string;
  referenceNo: string;
  footer: string;
  aiEnabled: boolean;
  onDraft: (language: Lang, draft: CustomDraft) => void;
  onEditDetails: () => void;
}) {
  const hasHindi = Boolean(custom.drafts.hindi);
  const langs = useMemo<Lang[]>(() => (aiEnabled || hasHindi ? languagesFor(language) : ["english"]), [aiEnabled, hasHindi, language]);
  const [active, setActive] = useState<Lang | "both">(langs[0]);
  const [editing, setEditing] = useState<{ lang: Lang; text: string; title: string } | null>(null);
  const [working, setWorking] = useState<Lang | null>(null);
  const [pending, startTransition] = useTransition();
  const missing = missingRequired(entry, custom.answers);
  const blank = useMemo(() => templateAsDraft(entry.title, templateText), [entry.title, templateText]);

  const draftFor = (lang: Lang): CustomDraft | null => custom.drafts[lang] ?? (!aiEnabled && lang === "english" ? blank : null);
  const html = useMemo(() => {
    const drafts = (active === "both" ? langs : [active]).flatMap((lang) => {
      const draft = custom.drafts[lang] ?? (!aiEnabled && lang === "english" ? blank : null);
      return draft ? [{ language: lang, draft }] : [];
    });
    return drafts.length ? customDraftHtml({ drafts, title, referenceNo, footer }) : "";
  }, [active, langs, custom.drafts, aiEnabled, blank, title, referenceNo, footer]);

  const create = (lang: Lang) => {
    setWorking(lang);
    const toastId = toast.loading("Preparing your " + (lang === "hindi" ? "Hindi" : "English") + " draft… this can take a minute or two.");
    void draftFromTemplate({ id: deedId, language: lang })
      .then((result) => {
        if (result.error !== undefined) return toast.error(result.error, { id: toastId });
        onDraft(lang, result.draft);
        toast.success("Draft ready. Please read it carefully.", { id: toastId });
      })
      .catch(() => toast.error("Could not prepare the draft. Please try again.", { id: toastId }))
      .finally(() => setWorking(null));
  };

  const saveEdit = () => {
    if (!editing) return;
    const draft: CustomDraft = { title: editing.title.trim() || entry.title, paragraphs: textToParagraphs(editing.text), edited: true };
    if (!draft.paragraphs.length) return toast.error("The draft is empty.");
    startTransition(async () => {
      const result = await saveCustomDraft({ id: deedId, language: editing.lang, draft });
      if (result.error !== undefined) return void toast.error(result.error);
      onDraft(editing.lang, draft);
      setEditing(null);
      toast.success("Draft saved.");
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
    download(["﻿", doc], "application/msword", referenceNo + (active === "hindi" ? "-hi" : active === "english" ? "-en" : "") + ".doc");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        {missing.length ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Some required details are missing</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5">{missing.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>
            <button className="mt-2 font-semibold underline" onClick={onEditDetails} type="button">Fill them in</button>
          </section>
        ) : (
          <section className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="size-4" /> All required details are filled.</section>
        )}

        <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="font-semibold text-primary">Your draft</h2>
          {aiEnabled ? (
            <>
              <p className="text-sm text-muted-foreground">AI fills this template with your answers. Read the draft carefully before signing.</p>
              {langs.map((lang) => (
                <Button className="h-10 w-full" disabled={working !== null} key={lang} onClick={() => create(lang)} type="button" variant={custom.drafts[lang] ? "outline" : "default"}>
                  {working === lang ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {(custom.drafts[lang] ? "Re-create " : "Create ") + (langs.length > 1 ? langLabels[lang] + " draft" : "draft")}
                </Button>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The AI assistant is not set up, so this shows the blank template. Download it and fill the blanks by hand, or ask your administrator to set up AI.</p>
          )}
        </section>

        {html ? (
          <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-1 font-semibold text-primary">Download</h2>
            <Button className="h-10 w-full" onClick={downloadWord} type="button"><FileDown className="size-4" /> Word (.doc)</Button>
            <Button className="h-10 w-full" onClick={print} type="button" variant="outline"><Printer className="size-4" /> Print / save as PDF</Button>
            <p className="pt-1 text-xs leading-5 text-muted-foreground">This is a draft. Check names, numbers and dates, and take legal advice for important matters. Some documents need stamp paper and registration.</p>
          </section>
        ) : null}
      </aside>

      <section className="overflow-hidden rounded-xl border border-border bg-secondary/40 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
          {langs.length > 1 ? (
            <div className="grid grid-flow-col gap-1 rounded-lg bg-secondary p-1 text-sm font-semibold" role="tablist">
              {[...langs, "both" as const].map((item) => (
                <button aria-selected={active === item} className={cn("rounded-md px-3 py-1.5", item === "hindi" && "font-devanagari", active === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground")} key={item} onClick={() => setActive(item)} role="tab" type="button">
                  {item === "both" ? "Both" : langLabels[item]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-primary">Preview</p>
          )}
          {active !== "both" && draftFor(active) ? (
            <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-secondary" onClick={() => { const draft = draftFor(active)!; setEditing({ lang: active, title: draft.title, text: draftToText(draft) }); }} type="button">
              <Pencil className="size-4" /> Edit text
            </button>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-3 bg-card p-4">
            <input aria-label="Document heading" className={inputClass + " font-semibold"} onChange={(event) => setEditing({ ...editing, title: event.target.value })} value={editing.title} />
            <textarea aria-label="Draft text" className={textareaClass + " min-h-[60vh] font-serif text-[15px] leading-7"} onChange={(event) => setEditing({ ...editing, text: event.target.value })} value={editing.text} />
            <p className="text-xs text-muted-foreground">Leave an empty line between paragraphs.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="h-10" onClick={() => setEditing(null)} type="button" variant="outline"><X className="size-4" /> Cancel</Button>
              <Button className="h-10" disabled={pending} onClick={saveEdit} type="button">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save text</Button>
            </div>
          </div>
        ) : html ? (
          <iframe className="h-[70vh] min-h-[480px] w-full bg-white sm:h-[80vh]" sandbox="allow-same-origin" srcDoc={html} title="Draft preview" />
        ) : (
          <div className="grid min-h-[360px] place-items-center p-8 text-center">
            <div>
              <Sparkles className="mx-auto size-8 text-accent-foreground" />
              <p className="mt-3 font-semibold text-primary">No draft yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Fill in the details, then press “Create draft”. It usually takes under a minute.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
