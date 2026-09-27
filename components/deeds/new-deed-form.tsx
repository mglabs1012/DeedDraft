"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, FileHeart, FileSignature, Gift, LoaderCircle, MapPinned, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createDeed } from "@/app/actions/deeds";
import { Button } from "@/components/ui/button";
import { deedTypeDescriptions, deedTypeLabels, type DeedType } from "@/lib/deeds";
import { createDeedSchema, type CreateDeedInput } from "@/lib/schemas/deeds";

const types: Array<Exclude<DeedType, "other">> = ["sale", "release", "gift", "partition", "will"];
const icons = { sale: FileSignature, release: FileHeart, gift: Gift, partition: MapPinned, will: ScrollText };
const inputClass = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export function NewDeedForm({ initialType }: { initialType?: DeedType }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const form = useForm<CreateDeedInput>({
    resolver: zodResolver(createDeedSchema),
    defaultValues: { deedType: initialType && initialType !== "other" ? initialType : "sale", title: "", language: "english", remarks: "" },
  });
  const selectedType = form.watch("deedType");

  const next = async () => {
    const valid = await form.trigger("deedType");
    if (valid) setStep(2);
  };

  const submit = form.handleSubmit((values) => {
    startTransition(() => {
      void createDeed(values).then((result) => {
        if (result.error) return toast.error(result.error);
        if (result.id) {
          toast.success("Deed created.");
          router.push("/app/deeds/" + result.id);
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
            {item === 1 ? <span className="h-px w-10 bg-border sm:w-16" /> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {types.map((type) => {
              const Icon = icons[type];
              const active = selectedType === type;
              return (
                <button
                  className={"rounded-xl border p-5 text-left transition " + (active ? "border-primary bg-secondary ring-2 ring-primary/15" : "border-border bg-card hover:border-primary/40")}
                  key={type}
                  onClick={() => form.setValue("deedType", type, { shouldValidate: true })}
                  type="button"
                >
                  <Icon className="size-6 text-accent-foreground" />
                  <p className="mt-5 font-semibold text-primary">{deedTypeLabels[type]}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{deedTypeDescriptions[type]}</p>
                </button>
              );
            })}
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-5 opacity-70">
              <p className="font-semibold text-primary">Other / Custom</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Coming soon—custom drafting workflows are planned next.</p>
            </div>
          </div>
          <div className="mt-8 flex justify-end"><Button onClick={next} type="button">Continue <ArrowRight className="size-4" /></Button></div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <label className="block space-y-2 text-sm font-medium">
            Matter title
            <input className={inputClass} placeholder="e.g. Sale Deed – Plot 12, Vaishali Nagar" {...form.register("title")} />
            <span className="text-xs font-normal text-destructive">{form.formState.errors.title?.message}</span>
          </label>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Draft language</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["english", "hindi", "bilingual"] as const).map((language) => (
                <label className={"cursor-pointer rounded-lg border p-3 text-sm capitalize " + (form.watch("language") === language ? "border-primary bg-secondary" : "border-border")} key={language}>
                  <input className="sr-only" type="radio" value={language} {...form.register("language")} />
                  {language === "bilingual" ? "Bilingual" : language === "hindi" ? "Hindi" : "English"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-2 text-sm font-medium">
            Initial notes <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea className="min-h-28 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Any initial instructions for this matter…" {...form.register("remarks")} />
            <span className="text-xs font-normal text-destructive">{form.formState.errors.remarks?.message}</span>
          </label>
          <div className="flex items-center justify-between border-t border-border pt-6">
            <Button onClick={() => setStep(1)} type="button" variant="outline"><ArrowLeft className="size-4" /> Back</Button>
            <Button disabled={pending} type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Create deed</Button>
          </div>
        </div>
      )}
    </form>
  );
}
