"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createDeed } from "@/app/actions/deeds";
import { DeedIcon } from "@/components/deeds/deed-icon";
import { Button } from "@/components/ui/button";
import { deedTypeOrder, deedTypes, type DeedType } from "@/lib/deed-types";
import { createDeedSchema, type CreateDeedInput } from "@/lib/schemas/deeds";
import { cn } from "@/lib/utils";

const inputClass = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const titleExamples: Partial<Record<DeedType, string>> = {
  sale: "e.g. Sale Deed – Plot 39, Badgaon (Kesar Devi to Manju Devi)",
  agreement_to_sell: "e.g. ATS – House 04 & 5-A, Kiranipura",
  gift: "e.g. Gift Deed – Plot G-179, Prithviraj Nagar",
  lease: "e.g. Lease – Shops 1 & 2, India Heights, 2nd floor",
  rent: "e.g. Rent Deed – SS 185/23, Martindale Bridge",
};

const languages = [
  { value: "hindi", label: "Hindi", hint: "हिंदी मसौदा" },
  { value: "english", label: "English", hint: "English draft" },
  { value: "bilingual", label: "Bilingual", hint: "Hindi + English" },
] as const;

export function NewDeedForm({ initialType }: { initialType?: DeedType }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const startType = initialType ?? "sale";
  const form = useForm<CreateDeedInput>({
    resolver: zodResolver(createDeedSchema),
    defaultValues: { deedType: startType, title: "", language: deedTypes[startType].defaultLanguage, remarks: "" },
  });
  const selectedType = form.watch("deedType");
  const selectedLanguage = form.watch("language");

  const choose = (type: DeedType) => {
    form.setValue("deedType", type, { shouldValidate: true });
    form.setValue("language", deedTypes[type].defaultLanguage);
  };

  const submit = form.handleSubmit((values) => {
    startTransition(() => {
      void createDeed(values).then((result) => {
        if (result.error) return toast.error(result.error);
        if (result.id) {
          toast.success("Deed created.");
          router.push("/app/deeds/" + result.id + "?tab=documents");
          router.refresh();
        }
      });
    });
  });

  return (
    <form noValidate onSubmit={submit}>
      <div className="mb-8 flex items-center gap-3">
        {[1, 2].map((item) => (
          <div className="flex items-center gap-3" key={item}>
            <span className={"grid size-7 place-items-center rounded-full text-xs font-bold " + (step >= item ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
              {step > item ? <Check className="size-4" /> : item}
            </span>
            <span className={"text-sm font-medium " + (step >= item ? "text-primary" : "text-muted-foreground")}>{item === 1 ? "Choose type" : "Matter details"}</span>
            {item === 1 ? <span className="h-px w-8 bg-border sm:w-16" /> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {deedTypeOrder.map((type) => {
              const config = deedTypes[type];
              const active = selectedType === type;
              return (
                <button
                  aria-pressed={active}
                  className={cn("rounded-xl border p-4 text-left transition sm:p-5", active ? "border-primary bg-secondary ring-2 ring-primary/15" : "border-border bg-card hover:border-primary/40")}
                  key={type}
                  onClick={() => choose(type)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <DeedIcon className="size-6 text-accent-foreground" type={type} />
                    {type === "agreement_to_sell" || type === "lease" || type === "rent" ? <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">New</span> : null}
                  </div>
                  <p className="mt-4 font-semibold text-primary">{config.label}</p>
                  <p className="font-devanagari text-sm text-foreground/80">{config.labelHi}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{config.description}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-end"><Button className="h-10" onClick={() => setStep(2)} type="button">Continue <ArrowRight className="size-4" /></Button></div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
            <DeedIcon className="size-5 text-accent-foreground" type={selectedType} />
            <p className="text-sm font-semibold text-primary">{deedTypes[selectedType].label} <span className="font-devanagari font-normal text-muted-foreground">· {deedTypes[selectedType].labelHi}</span></p>
            <button className="ml-auto text-xs font-semibold text-primary hover:underline" onClick={() => setStep(1)} type="button">Change</button>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            Matter title
            <input className={inputClass} placeholder={titleExamples[selectedType] ?? "e.g. " + deedTypes[selectedType].label + " – property and parties"} {...form.register("title")} />
            <span className="text-xs font-normal text-destructive">{form.formState.errors.title?.message}</span>
          </label>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Draft language</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {languages.map((language) => (
                <label className={cn("cursor-pointer rounded-lg border p-3 text-sm", selectedLanguage === language.value ? "border-primary bg-secondary" : "border-border")} key={language.value}>
                  <input className="sr-only" type="radio" value={language.value} {...form.register("language")} />
                  <span className="font-medium text-primary">{language.label}</span>
                  <span className="block font-devanagari text-xs text-muted-foreground">{language.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-2 text-sm font-medium">
            Client instructions <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea className="min-h-28 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Any initial instructions for this matter…" {...form.register("remarks")} />
            <span className="text-xs font-normal text-destructive">{form.formState.errors.remarks?.message}</span>
          </label>
          <div className="flex items-center justify-between border-t border-border pt-6">
            <Button className="h-10" onClick={() => setStep(1)} type="button" variant="outline"><ArrowLeft className="size-4" /> Back</Button>
            <Button className="h-10" disabled={pending} type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Create deed</Button>
          </div>
        </div>
      )}
    </form>
  );
}
