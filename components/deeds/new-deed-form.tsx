"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createDeed } from "@/app/actions/deeds";
import { DeedIcon } from "@/components/deeds/deed-icon";
import { categoryIcons, TemplateSearch } from "@/components/templates/template-search";
import { Button } from "@/components/ui/button";
import { deedTypes, type DeedType } from "@/lib/deed-types";
import { createDeedSchema, type CreateDeedInput } from "@/lib/schemas/deeds";
import { categoryById, coreOrder, type CatalogItem, type LibraryEntry } from "@/lib/templates/catalog";
import { cn } from "@/lib/utils";

const inputClass = "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm";

const titleExamples: Partial<Record<DeedType, string>> = {
  sale: "e.g. Sale of Plot 39, Badgaon – Kesar Devi to Manju Devi",
  agreement_to_sell: "e.g. Agreement to sell House 04, Kiranipura",
  gift: "e.g. Gift of Plot G-179 to my son",
  lease: "e.g. Lease of Shops 1 & 2, India Heights",
  rent: "e.g. Rent agreement – Flat 185, Martindale Bridge",
};

const languages = [
  { value: "hindi", label: "Hindi", hint: "हिंदी" },
  { value: "english", label: "English", hint: "English" },
  { value: "bilingual", label: "Both", hint: "Hindi + English" },
] as const;

export function NewDeedForm({ initialType, initialTemplate, library, aiEnabled }: { initialType?: DeedType; initialTemplate?: LibraryEntry; library: LibraryEntry[]; aiEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(initialType || initialTemplate ? 2 : 1);
  const [showSearch, setShowSearch] = useState(false);
  const [template, setTemplate] = useState<LibraryEntry | null>(initialTemplate ?? null);
  const [pending, startTransition] = useTransition();
  const startType = initialType ?? "sale";
  const form = useForm<CreateDeedInput>({
    resolver: zodResolver(createDeedSchema),
    defaultValues: initialTemplate
      ? { deedType: "other", templateId: initialTemplate.id, title: initialTemplate.title, language: "english", remarks: "" }
      : { deedType: startType, title: "", language: deedTypes[startType].defaultLanguage, remarks: "" },
  });
  const selectedType = form.watch("deedType");
  const selectedLanguage = form.watch("language");

  const chooseCore = (type: DeedType) => {
    setTemplate(null);
    form.reset({ deedType: type, templateId: undefined, title: "", language: deedTypes[type].defaultLanguage, remarks: form.getValues("remarks") });
    setStep(2);
  };

  const chooseTemplate = (entry: LibraryEntry) => {
    setTemplate(entry);
    form.reset({ deedType: "other", templateId: entry.id, title: entry.title, language: "english", remarks: form.getValues("remarks") });
    setStep(2);
  };

  const pick = (item: CatalogItem) => {
    if (item.kind === "core") return chooseCore(item.id as DeedType);
    const entry = library.find((candidate) => candidate.id === item.id);
    if (entry) chooseTemplate(entry);
  };

  const submit = form.handleSubmit((values) => {
    startTransition(() => {
      void createDeed(values).then((result) => {
        if (result.error) return toast.error(result.error);
        if (result.id) {
          toast.success("Document created.");
          router.push("/app/deeds/" + result.id);
          router.refresh();
        }
      });
    });
  });

  const TemplateIcon = template ? categoryIcons[template.category] : null;

  return (
    <form noValidate onSubmit={submit}>
      <div className="mb-6 flex items-center gap-3 sm:mb-8">
        {[1, 2].map((item) => (
          <div className="flex items-center gap-3" key={item}>
            <span className={"grid size-7 place-items-center rounded-full text-xs font-bold " + (step >= item ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
              {step > item ? <Check className="size-4" /> : item}
            </span>
            <span className={"text-sm font-medium " + (step >= item ? "text-primary" : "text-muted-foreground")}>{item === 1 ? "Choose document" : "Basic details"}</span>
            {item === 1 ? <span className="h-px w-8 bg-border sm:w-16" /> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div>
          <h2 className="text-lg font-semibold text-primary">What would you like to make?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Most people start with one of these.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {coreOrder.map((type) => {
              const config = deedTypes[type];
              return (
                <button className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-secondary/40" key={type} onClick={() => chooseCore(type)} type="button">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><DeedIcon className="size-5" type={type} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-primary">{config.label} <span className="font-devanagari text-sm font-normal text-foreground/70">· {config.labelHi}</span></span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{config.description}</span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                </button>
              );
            })}
            <button
              aria-expanded={showSearch}
              className={cn("group flex items-start gap-3 rounded-xl border p-4 text-left transition", showSearch ? "border-primary bg-secondary ring-2 ring-primary/15" : "border-dashed border-primary/40 bg-card hover:bg-secondary/40")}
              onClick={() => setShowSearch((open) => !open)}
              type="button"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Search className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-primary">Other documents <span className="font-devanagari text-sm font-normal text-foreground/70">· अन्य</span></span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Search {library.length}+ templates — affidavit, notice, loan, power of attorney…</span>
              </span>
            </button>
          </div>

          {showSearch ? (
            <section className="mt-6 rounded-xl border border-border bg-secondary/30 p-3 sm:p-5">
              <h3 className="font-semibold text-primary">Search all templates</h3>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">Type what you need in simple words. Tap a result to continue.</p>
              <TemplateSearch autoFocus library={library} onSelect={pick} />
              <button className="mt-4 text-sm font-semibold text-primary hover:underline" onClick={() => chooseCore("other")} type="button">
                Can&apos;t find it? Start a blank custom document
              </button>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
            {template && TemplateIcon ? <TemplateIcon className="size-5 shrink-0 text-accent-foreground" /> : <DeedIcon className="size-5 shrink-0 text-accent-foreground" type={selectedType} />}
            <p className="min-w-0 text-sm font-semibold text-primary">
              {template ? template.title : deedTypes[selectedType].label}
              <span className="font-normal text-muted-foreground"> · {template ? categoryById[template.category].label : deedTypes[selectedType].labelHi}</span>
            </p>
            <button className="ml-auto shrink-0 text-xs font-semibold text-primary hover:underline" onClick={() => setStep(1)} type="button">Change</button>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            Give it a name
            <input className={inputClass} placeholder={titleExamples[selectedType] ?? "e.g. " + deedTypes[selectedType].label + " – property and people"} {...form.register("title")} />
            <span className="block text-xs font-normal text-muted-foreground">Only for your list of documents. You can change it later.</span>
            <span className="text-xs font-normal text-destructive">{form.formState.errors.title?.message}</span>
          </label>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Language of the document</legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {languages.map((language) => (
                <label className={cn("cursor-pointer rounded-lg border p-3 text-sm", selectedLanguage === language.value ? "border-primary bg-secondary" : "border-border")} key={language.value}>
                  <input className="sr-only" type="radio" value={language.value} {...form.register("language")} />
                  <span className="font-medium text-primary">{language.label}</span>
                  <span className="block font-devanagari text-xs text-muted-foreground">{language.hint}</span>
                </label>
              ))}
            </div>
            {template && selectedLanguage !== "english" ? (
              <p className="text-xs text-muted-foreground">{aiEnabled ? "The Hindi version is prepared by AI from your answers." : "Hindi needs the AI assistant, which is not set up yet. You will get the English template."}</p>
            ) : null}
          </fieldset>
          <label className="block space-y-2 text-sm font-medium">
            Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm" placeholder="Write in your own words, e.g. “Selling my plot to my cousin, half paid already.”" {...form.register("remarks")} />
            <span className="text-xs font-normal text-destructive">{form.formState.errors.remarks?.message}</span>
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button className="h-11 sm:h-10" onClick={() => setStep(1)} type="button" variant="outline"><ArrowLeft className="size-4" /> Back</Button>
            <Button className="h-11 sm:h-10" disabled={pending} type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Create document</Button>
          </div>
        </div>
      )}
    </form>
  );
}
