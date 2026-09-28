"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { draftClauses } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { inputClass, textareaClass } from "@/components/ui/field";
import type { DeedLanguage } from "@/lib/deeds";

export function ClauseAssistant({ deedId, deedLanguage, onInsert }: { deedId: string; deedLanguage: DeedLanguage; onInsert: (clauses: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [language, setLanguage] = useState<"hindi" | "english">(deedLanguage === "english" ? "english" : "hindi");
  const [clauses, setClauses] = useState<string[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      const result = await draftClauses({ deedId, instructions, language });
      if (result.error !== undefined) {
        toast.error(result.error);
        return;
      }
      setClauses(result.clauses);
      setChosen(new Set(result.clauses.map((_, index) => index)));
    });

  const insert = () => {
    onInsert(clauses.filter((_, index) => chosen.has(index)));
    setClauses([]);
    setInstructions("");
    setOpen(false);
    toast.success("Clauses added. Review them and save terms.");
  };

  if (!open) {
    return (
      <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-foreground hover:underline" onClick={() => setOpen(true)} type="button">
        <Sparkles className="size-4" /> Draft clauses with AI
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="size-4 text-accent-foreground" /> AI clause assistant</p>
        <select aria-label="Clause language" className={inputClass + " h-8 w-auto py-0 text-xs"} onChange={(event) => setLanguage(event.target.value as "hindi" | "english")} value={language}>
          <option value="hindi">हिंदी</option>
          <option value="english">English</option>
        </select>
      </div>
      <textarea
        className={textareaClass + " min-h-20 bg-card"}
        maxLength={3000}
        onChange={(event) => setInstructions(event.target.value)}
        placeholder="e.g. Seller will clear pending electricity and water bills before registration; buyer may construct a boundary wall on the east side."
        value={instructions}
      />
      <div className="flex flex-wrap gap-2">
        <Button className="h-9" disabled={pending || instructions.trim().length < 5} onClick={generate} type="button">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {clauses.length ? "Regenerate" : "Draft clauses"}
        </Button>
        <Button className="h-9" onClick={() => setOpen(false)} type="button" variant="ghost">Close</Button>
      </div>
      {clauses.length ? (
        <div className="space-y-2">
          {clauses.map((clause, index) => (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm leading-6" key={index}>
              <input
                checked={chosen.has(index)}
                className="mt-1.5 size-4 shrink-0 accent-[var(--primary)]"
                onChange={() =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
                type="checkbox"
              />
              <span className={language === "hindi" ? "font-devanagari" : ""}>{clause}</span>
            </label>
          ))}
          <Button className="h-9" disabled={!chosen.size} onClick={insert} type="button" variant="outline"><Plus className="size-4" /> Insert {chosen.size} clause{chosen.size === 1 ? "" : "s"}</Button>
          <p className="text-xs text-muted-foreground">AI-drafted text — review carefully before use. Identity numbers are not sent to the AI.</p>
        </div>
      ) : null}
    </div>
  );
}
