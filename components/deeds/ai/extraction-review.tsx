"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, LoaderCircle, Sparkles } from "lucide-react";

import type { SaveSection } from "@/components/deeds/sections/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { mergeExtraction } from "@/lib/ai/contract";
import type { Extraction } from "@/lib/ai/parse";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { formatINR, instrumentLabels, paymentModeLabels } from "@/lib/deeds";
import { areaTriple, displayName } from "@/lib/drafting/format";
import { shortDate } from "@/lib/drafting/hindi";
import type { DeedData } from "@/lib/schemas/deed-data";

type ListKey = "parties" | "properties" | "titleChain" | "payments";
const sectionKeys = ["parties", "properties", "titleChain", "payments", "consideration"] as const;

function Row({ id, title, detail, checked, onToggle }: { id: string; title: string; detail: string; checked: Set<string>; onToggle: (id: string) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-secondary/40">
      <input checked={checked.has(id)} className="mt-1 size-4 accent-[var(--primary)]" onChange={() => onToggle(id)} type="checkbox" />
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold text-primary">{title}</span>
        {detail ? <span className="block break-words text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </label>
  );
}

function Group({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  if (!count) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-primary">{title} <span className="font-normal text-muted-foreground">({count})</span></h3>
      {children}
    </section>
  );
}

export function ExtractionReview({
  extraction,
  fileName,
  deedType,
  data,
  save,
  onClose,
}: {
  extraction: Extraction;
  fileName: string;
  deedType: DeedType;
  data: DeedData;
  save: SaveSection;
  onClose: () => void;
}) {
  const roles = getDeedType(deedType).roles;
  const [selected, setSelected] = useState<Set<string>>(() => new Set([...extraction.parties, ...extraction.properties, ...extraction.titleChain, ...extraction.payments].map((item) => item.id)));
  const [useConsideration, setUseConsideration] = useState(Boolean(extraction.consideration.total || extraction.consideration.marketValue));
  const [pending, startTransition] = useTransition();
  const empty = !extraction.parties.length && !extraction.properties.length && !extraction.titleChain.length && !extraction.payments.length && !useConsideration;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () =>
    startTransition(async () => {
      const pick = <K extends ListKey>(key: K) => (extraction[key] as Array<{ id: string }>).filter((item) => selected.has(item.id)) as DeedData[K];
      const merged = mergeExtraction(data, {
        parties: pick("parties"),
        properties: pick("properties"),
        titleChain: pick("titleChain"),
        payments: pick("payments"),
        ...(useConsideration ? { consideration: extraction.consideration } : {}),
      });
      for (const key of sectionKeys) {
        if (JSON.stringify(merged[key]) !== JSON.stringify(data[key]) && !(await save(key, merged[key]))) return;
      }
      onClose();
    });

  return (
    <Modal
      className="sm:max-w-2xl"
      description={fileName}
      footer={
        <>
          <Button className="h-10" onClick={onClose} type="button" variant="outline">Discard</Button>
          <Button className="h-10" disabled={pending || empty} onClick={apply} type="button">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Add selected to matter
          </Button>
        </>
      }
      onClose={onClose}
      open
      title="Review AI extraction"
    >
      <div className="space-y-5">
        {extraction.summary ? <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">{extraction.summary}</p> : null}
        {extraction.warnings.length ? (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {extraction.warnings.map((warning) => <li className="flex gap-2" key={warning}><AlertTriangle className="mt-0.5 size-4 shrink-0" />{warning}</li>)}
          </ul>
        ) : null}
        <p className="text-xs text-muted-foreground">Verify every value against the original. Selected items are added; fields you have already filled are never overwritten.</p>

        <Group count={extraction.parties.length} title="Parties">
          {extraction.parties.map((party) => (
            <Row checked={selected} onToggle={toggle} detail={[roles[party.role].en, party.relativeName ? party.relation + " " + party.relativeName : "", party.age ? party.age + " yrs" : "", party.address].filter(Boolean).join(" · ")} id={party.id} key={party.id} title={displayName(party, "hindi")} />
          ))}
        </Group>
        <Group count={extraction.properties.length} title="Properties">
          {extraction.properties.map((property) => (
            <Row checked={selected} onToggle={toggle} detail={[property.khasra ? "Khasra " + property.khasra : "", property.area ? areaTriple(property, "english") : "", [property.locality, property.village, property.district].filter(Boolean).join(", ")].filter(Boolean).join(" · ")} id={property.id} key={property.id} title={[property.identifier, property.description].filter(Boolean).join(" — ")} />
          ))}
        </Group>
        <Group count={extraction.titleChain.length} title="Chain of title">
          {extraction.titleChain.map((entry) => (
            <Row checked={selected} onToggle={toggle} detail={[entry.from, entry.office ? "SR " + entry.office : "", entry.volume ? "Vol " + entry.volume : "", entry.serial ? "Sr " + entry.serial : ""].filter(Boolean).join(" · ")} id={entry.id} key={entry.id} title={instrumentLabels[entry.instrument] + (entry.date ? " · " + shortDate(entry.date) : "")} />
          ))}
        </Group>
        <Group count={extraction.payments.length} title="Payments">
          {extraction.payments.map((payment) => (
            <Row checked={selected} onToggle={toggle} detail={[payment.reference, payment.bank, payment.lender, payment.date ? shortDate(payment.date) : ""].filter(Boolean).join(" · ")} id={payment.id} key={payment.id} title={formatINR(payment.amount) + " · " + paymentModeLabels[payment.mode]} />
          ))}
        </Group>
        {extraction.consideration.total || extraction.consideration.marketValue ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
            <input checked={useConsideration} className="mt-1 size-4 accent-[var(--primary)]" onChange={(event) => setUseConsideration(event.target.checked)} type="checkbox" />
            <span className="text-sm">
              <span className="block font-semibold text-primary">Consideration</span>
              <span className="text-xs text-muted-foreground">{[extraction.consideration.total ? "Total " + formatINR(extraction.consideration.total) : "", extraction.consideration.marketValue ? "DLC " + formatINR(extraction.consideration.marketValue) : ""].filter(Boolean).join(" · ")}</span>
            </span>
          </label>
        ) : null}
        {empty ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing usable was found in this document.</p> : null}
      </div>
    </Modal>
  );
}
