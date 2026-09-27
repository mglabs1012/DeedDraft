"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle, FileDown, Printer, Stamp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildDraftHtml, type ReadinessItem } from "@/lib/draft";
import type { DeedStatus, DeedType } from "@/lib/deeds";
import type { DeedData } from "@/lib/schemas/deed-data";

type Props = {
  type: DeedType;
  title: string;
  referenceNo: string;
  data: DeedData;
  firmName: string;
  city: string;
  readiness: ReadinessItem[];
  status: DeedStatus;
  onMarkGenerated: () => void;
  onJump: (tab: ReadinessItem["tab"]) => void;
  pending: boolean;
};

export function DraftGenerator({ type, title, referenceNo, data, firmName, city, readiness, status, onMarkGenerated, onJump, pending }: Props) {
  const html = useMemo(() => buildDraftHtml({ type, title, referenceNo, data, firmName, city }), [type, title, referenceNo, data, firmName, city]);
  const required = readiness.filter((item) => !item.optional);
  const missing = required.filter((item) => !item.done);

  const print = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 250);
  };

  const download = () => {
    const doc = html.replace("<html>", "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>");
    const url = URL.createObjectURL(new Blob(["﻿", doc], { type: "application/msword" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = referenceNo + ".doc";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="font-semibold text-primary">Draft readiness</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {missing.length ? missing.length + " required item" + (missing.length === 1 ? "" : "s") + " left." : "All required details are in place."}
          </p>
          <ul className="mt-4 space-y-2">
            {readiness.map((item) => (
              <li key={item.label}>
                <button className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => onJump(item.tab)} type="button">
                  {item.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
                    {item.label}
                    {item.optional ? <span className="text-xs"> · recommended</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 font-semibold text-primary">Export</h2>
          <Button className="h-10 w-full" onClick={download} type="button"><FileDown className="size-4" /> Download Word (.doc)</Button>
          <Button className="h-10 w-full" onClick={print} type="button" variant="outline"><Printer className="size-4" /> Print / save as PDF</Button>
          {status !== "generated" && status !== "finalized" ? (
            <Button className="h-10 w-full" disabled={pending || missing.length > 0} onClick={onMarkGenerated} type="button" variant="secondary">
              <Stamp className="size-4" /> Mark as generated
            </Button>
          ) : null}
          <p className="pt-2 text-xs leading-5 text-muted-foreground">Drafts are generated from the details in this matter. Review every particular against the original documents before execution.</p>
        </section>
      </aside>
      <section className="overflow-hidden rounded-xl border border-border bg-secondary/40 shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <p className="text-sm font-semibold text-primary">Preview</p>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Draft</span>
        </div>
        <iframe className="h-[70vh] min-h-[480px] w-full bg-white sm:h-[78vh]" sandbox="allow-same-origin" srcDoc={html} title="Draft preview" />
      </section>
    </div>
  );
}
