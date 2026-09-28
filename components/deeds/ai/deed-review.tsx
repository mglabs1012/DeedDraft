"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { reviewDeed } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import type { ReviewIssue } from "@/lib/ai/parse";
import type { SectionId } from "@/lib/deed-types";
import { cn } from "@/lib/utils";

const severityStyles: Record<ReviewIssue["severity"], string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-700",
};

const tabFor: Record<string, SectionId | undefined> = {
  parties: "parties",
  properties: "properties",
  title: "title",
  payments: "payments",
  terms: "terms",
  execution: "terms",
};

export function DeedReview({ deedId, onJump }: { deedId: string; onJump: (tab: SectionId) => void }) {
  const [issues, setIssues] = useState<ReviewIssue[] | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const result = await reviewDeed({ deedId });
      if (result.error !== undefined) {
        toast.error(result.error);
        return;
      }
      const order = { high: 0, medium: 1, low: 2 };
      setIssues([...result.issues].sort((a, b) => order[a.severity] - order[b.severity]));
    });

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold text-primary"><ShieldCheck className="size-4 text-accent-foreground" /> AI legal review</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Checks particulars, payments, TDS, title references and instrument-specific risks.</p>
      <Button className="mt-3 h-10 w-full" disabled={pending} onClick={run} type="button" variant="outline">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {issues ? "Review again" : "Review this matter"}
      </Button>
      {issues ? (
        issues.length ? (
          <ul className="mt-4 space-y-2">
            {issues.map((issue, index) => {
              const tab = tabFor[issue.section];
              return (
                <li key={index}>
                  <button className="w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-secondary/50 disabled:cursor-default" disabled={!tab} onClick={() => tab && onJump(tab)} type="button">
                    <span className={cn("mr-2 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", severityStyles[issue.severity])}>{issue.severity}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{issue.section}</span>
                    <span className="mt-1.5 block leading-5 text-foreground">{issue.message}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> No issues found.</p>
        )
      ) : null}
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">AI suggestions are not legal advice. Identity numbers are not sent.</p>
    </section>
  );
}
