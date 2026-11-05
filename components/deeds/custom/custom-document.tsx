"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { saveCustomAnswers } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import type { CustomDoc } from "@/lib/schemas/deed-data";
import type { LibraryEntry } from "@/lib/templates/catalog";
import { formFor, type FormField } from "@/lib/templates/forms";

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
