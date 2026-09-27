import Link from "next/link";
import { ArrowRight, Check, FileHeart, FileSignature, Gift, MapPinned, ScrollText } from "lucide-react";

import { deedTypeDescriptions, deedTypeLabels, hasConsideration, partyRoleLabels, type DeedType } from "@/lib/deeds";

export const metadata = { title: "Templates" };

const templates: Array<{ type: Exclude<DeedType, "other">; icon: typeof FileSignature; clauses: string[] }> = [
  { type: "sale", icon: FileSignature, clauses: ["Recitals of title", "Sale consideration in words", "Payment schedule (cheque / RTGS / UTR)", "Delivery of possession", "Encumbrance & indemnity", "Mutation rights"] },
  { type: "gift", icon: Gift, clauses: ["Natural love & affection", "No consideration", "Acceptance by donee", "Delivery of possession", "Irrevocability"] },
  { type: "release", icon: FileHeart, clauses: ["Joint rights recital", "Relinquishment of share", "Optional consideration", "Sole ownership of releasee", "Mutation rights"] },
  { type: "partition", icon: MapPinned, clauses: ["Joint ownership recital", "Division by metes and bounds", "Allotment schedule", "Exclusive enjoyment", "Separate mutation"] },
  { type: "will", icon: ScrollText, clauses: ["Sound mind declaration", "Revocation of earlier wills", "Bequest to beneficiaries", "Appointment of executor", "Attestation by two witnesses"] },
];

export default function TemplatesPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Template library</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Deed templates</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Each template turns the parties, property schedule and payments you record in a matter into a structured draft for advocate review.</p>
      <div className="mt-6 grid gap-4 sm:mt-7 md:grid-cols-2 xl:grid-cols-3">
        {templates.map(({ type, icon: Icon, clauses }) => {
          const roles = partyRoleLabels[type];
          return (
            <article className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm" key={type}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-accent-foreground"><Icon className="size-5" /></span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-primary">{deedTypeLabels[type]}</h2>
                  <p className="text-sm text-muted-foreground">{deedTypeDescriptions[type]}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground">{roles.first.split(" (")[0]} → {roles.second.split(" (")[0]}</span>
                {hasConsideration(type) ? <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">With consideration</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">No consideration</span>}
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-foreground/80">
                {clauses.map((clause) => <li className="flex gap-2" key={clause}><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{clause}</li>)}
              </ul>
              <Link className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href={"/app/deeds/new?type=" + type}>
                Use this template <ArrowRight className="size-4" />
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
