"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, FileText, Gauge, Landmark, LoaderCircle, PenLine, ScrollText, ShieldCheck, Sparkles, UploadCloud, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { reviewDeed } from "@/app/actions/ai";
import type { WorkspaceDocument } from "@/app/actions/upload";
import { PartiesSection } from "@/components/deeds/sections/parties";
import { Button } from "@/components/ui/button";
import type { ReviewIssue } from "@/lib/ai/parse";
import { getDeedType, type SectionId } from "@/lib/deed-types";
import { getReadiness, paymentsTotal } from "@/lib/drafting";
import { finalChecks } from "@/lib/drafting/checks";
import type { DeedData, PartyRole } from "@/lib/schemas/deed-data";
import { cn } from "@/lib/utils";
import type { Deed } from "@/types/database";
import { DocumentListFor, DraftRequest, PaperDropzone, PaperReader, PersonUploads, StatusArea, WorkspaceHeader } from "@/components/standard/parts";
import { NakshaPanel } from "@/components/standard/workspace";
import { useDeedWorkspace } from "@/components/standard/use-deed-workspace";

const PropertiesSection = dynamic(() => import("@/components/deeds/sections/properties").then((m) => m.PropertiesSection));
const TitleChainSection = dynamic(() => import("@/components/deeds/sections/title-chain").then((m) => m.TitleChainSection));
const PaymentsSection = dynamic(() => import("@/components/deeds/sections/payments").then((m) => m.PaymentsSection));
const TermsSection = dynamic(() => import("@/components/deeds/sections/terms").then((m) => m.TermsSection));
const StandardDraft = dynamic(() => import("@/components/standard/draft").then((m) => m.StandardDraft), { loading: () => <p className="py-12 text-sm text-muted-foreground">Opening draft…</p> });

export type PremiumTab = "overview" | SectionId | "draft";

const tabs: Array<{ id: PremiumTab; label: string; icon: typeof Gauge; hint: string }> = [
  { id: "overview", label: "Overview", icon: Gauge, hint: "Readiness, checks and AI review" },
  { id: "documents", label: "Papers", icon: UploadCloud, hint: "Upload and read the property papers" },
  { id: "parties", label: "People", icon: Users, hint: "Parties and witnesses" },
  { id: "properties", label: "Property", icon: Landmark, hint: "Schedule, boundaries and map" },
  { id: "title", label: "Title history", icon: ScrollText, hint: "Earlier deeds and registration" },
  { id: "payments", label: "Payments", icon: Wallet, hint: "Consideration and modes of payment" },
  { id: "terms", label: "Terms", icon: FileText, hint: "Terms, clauses and execution" },
  { id: "draft", label: "Draft", icon: PenLine, hint: "Prepare, edit, review and export" },
];

export function isPremiumTab(value: unknown): value is PremiumTab {
  return typeof value === "string" && tabs.some((tab) => tab.id === value);
}

/** Premium Mode: every part of the matter in its own section, for complex deeds. */
export function PremiumWorkspace({ deed, initialData, initialDocuments, aiEnabled, firmCity, firmName, firmId, initialTab }: {
  deed: Deed; initialData: DeedData; initialDocuments: WorkspaceDocument[]; aiEnabled: boolean;
  firmCity: string; firmName: string; firmId: string; initialTab?: PremiumTab;
}) {
  const config = getDeedType(deed.deed_type);
  // Payments only for deeds with a price; the title chain only where it applies.
  const visible = useMemo(() => tabs.filter((tab) => (tab.id !== "payments" || config.consideration !== "none") && (tab.id !== "title" || config.titleChain !== "none")), [config]);
  const [tab, setTabState] = useState<PremiumTab>(initialTab && visible.some((item) => item.id === initialTab) ? initialTab : "overview");
  const [uploadRole, setUploadRole] = useState<PartyRole | null>(null);
  const w = useDeedWorkspace({ deed, initialData, initialDocuments, aiEnabled, onDraftsReady: () => go("draft") });
  const { data } = w;
  const readiness = useMemo(() => getReadiness(deed.deed_type, data, w.documents.length), [deed.deed_type, data, w.documents.length]);
  const checks = useMemo(() => finalChecks(deed.deed_type, data, ""), [deed.deed_type, data]);
  const ai = aiEnabled ? { deedId: deed.id, firmId } : null;

  function go(requested: PremiumTab) {
    // A check or AI finding can point at a section this deed type hides (e.g. payments on a gift deed).
    const next = visible.some((item) => item.id === requested) ? requested : requested === "payments" ? "terms" : "overview";
    setTabState(next);
    // Keep the chosen section visible in the scrolling tab bar on phones.
    requestAnimationFrame(() => document.getElementById("premium-tab-" + next)?.scrollIntoView({ block: "nearest", inline: "center" }));
    try { window.history.replaceState(null, "", "?tab=" + next); } catch { /* URL sync is a convenience only */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (next === "draft") void w.fetchDrafts().catch(() => undefined);
  }
  // Opening a deed straight on its Draft tab (from a link) loads the saved versions.
  useEffect(() => { if (tab === "draft") void w.fetchDrafts().catch(() => undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const status = (id: PremiumTab): "done" | "todo" | "none" => {
    if (id === "overview") return "none";
    if (id === "draft") return w.drafts.length ? "done" : "none";
    const items = readiness.filter((item) => item.tab === id && !item.optional);
    if (!items.length) return "none";
    return items.every((item) => item.done) ? "done" : "todo";
  };
  const index = visible.findIndex((item) => item.id === tab);
  const previous = visible[index - 1];
  const next = visible[index + 1];

  return (
    <div className="space-y-5">
      <WorkspaceHeader w={w} deed={deed} mode="premium" canSwitch />
      <StatusArea w={w} deed={deed} aiEnabled={aiEnabled} uploadRole={uploadRole} onCloseUpload={() => setUploadRole(null)} showDocuments={false} />

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <nav data-tour="premium-nav" aria-label="Deed sections" className="-mx-4 overflow-x-auto border-b border-border px-4 lg:sticky lg:top-24 lg:mx-0 lg:self-start lg:overflow-visible lg:border-0 lg:px-0">
          <ol className="flex gap-1 lg:flex-col">
            {visible.map((item, position) => {
              const state = status(item.id);
              const Icon = item.icon;
              return <li key={item.id} className="shrink-0">
                <button id={"premium-tab-" + item.id} type="button" onClick={() => go(item.id)} aria-current={tab === item.id ? "page" : undefined} className={cn("flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition", tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-primary")}>
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1"><span className="hidden text-[10px] opacity-70 lg:inline">{position + 1}. </span>{item.label}</span>
                  {state === "done" ? <Check aria-label="complete" className={cn("size-3.5", tab === item.id ? "text-primary-foreground" : "text-emerald-600")} /> : state === "todo" ? <span aria-label="needs details" className="size-1.5 rounded-full bg-amber-500" /> : null}
                </button>
              </li>;
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-5">
          <div><h2 className="text-lg font-semibold text-primary">{visible[index]?.label}</h2><p className="text-sm text-muted-foreground">{visible[index]?.hint}</p></div>

          {tab === "overview" ? <div data-tour="premium-overview"><Overview deed={deed} data={data} readiness={readiness} checks={checks} documents={w.documents.length} drafts={w.drafts.length} aiEnabled={aiEnabled} onGo={go} /></div> : null}

          {tab === "documents" ? <div className="space-y-4">
            <PaperDropzone w={w} compact />
            <PersonUploads w={w} deed={deed} onOpen={setUploadRole} />
            <DocumentListFor w={w} aiEnabled={aiEnabled} open />
            <PaperReader w={w} />
          </div> : null}

          <fieldset disabled={w.disabled || w.extracting > 0} className="min-w-0 space-y-5">
            {tab === "parties" ? <PartiesSection deedType={deed.deed_type} parties={data.parties} save={w.save} ai={ai} documentNames={Object.fromEntries(w.documents.map((doc) => [doc.id, doc.file_name]))} /> : null}
            {tab === "properties" ? <>
              <PropertiesSection deedType={deed.deed_type} properties={data.properties} parties={data.parties} save={w.save} ai={ai} />
              <NakshaPanel w={w} />
            </> : null}
            {tab === "title" ? <TitleChainSection entries={data.titleChain} save={w.save} /> : null}
            {tab === "payments" ? <PaymentsSection deedType={deed.deed_type} consideration={data.consideration} payments={data.payments} save={w.save} /> : null}
            {tab === "terms" ? <TermsSection deedType={deed.deed_type} terms={data.terms} execution={data.execution} firmCity={firmCity} save={w.save} aiEnabled={aiEnabled} deedId={deed.id} deedLanguage={deed.language} /> : null}
          </fieldset>

          {tab === "draft" ? <div className="space-y-5">
            {checks.some((check) => check.severity === "error") ? <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />Fix the problems listed on the Overview before relying on this draft.</p> : null}
            <DraftRequest w={w} hasDrafts={w.drafts.length > 0} />
            {w.drafts.length ? <StandardDraft deed={deed} data={data} firmName={firmName} firmCity={firmCity} aiEnabled={aiEnabled} drafts={w.drafts} onSaved={(draft) => w.setDrafts((current) => [draft, ...current])} onLocalized={(localized) => w.acceptData({ ...w.dataRef.current, localized })} /> : null}
          </div> : null}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            {previous ? <Button type="button" variant="ghost" className="h-10" onClick={() => go(previous.id)}><ArrowLeft className="size-4" /> {previous.label}</Button> : <span />}
            {next ? <Button type="button" variant="outline" className="h-10" onClick={() => go(next.id)}>{next.label} <ArrowRight className="size-4" /></Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Overview({ deed, data, readiness, checks, documents, drafts, aiEnabled, onGo }: {
  deed: Deed; data: DeedData; readiness: ReturnType<typeof getReadiness>; checks: ReturnType<typeof finalChecks>;
  documents: number; drafts: number; aiEnabled: boolean; onGo: (tab: PremiumTab) => void;
}) {
  const required = readiness.filter((item) => !item.optional);
  const done = required.filter((item) => item.done).length;
  const percent = required.length ? Math.round((done / required.length) * 100) : 100;
  const roles = getDeedType(deed.deed_type).roles;
  const paid = paymentsTotal(data);
  const facts: Array<[string, string, PremiumTab]> = [
    [roles.first.en.split(" (")[0], String(data.parties.filter((party) => party.role === "first").length), "parties"],
    [roles.second.en.split(" (")[0], String(data.parties.filter((party) => party.role === "second").length), "parties"],
    ["Properties", String(data.properties.length), "properties"],
    ["Papers", String(documents), "documents"],
    ...(data.consideration.total ? [["Consideration", "₹" + data.consideration.total.toLocaleString("en-IN") + (paid ? " · paid ₹" + paid.toLocaleString("en-IN") : ""), "payments"] as [string, string, PremiumTab]] : []),
    ["Draft versions", String(drafts), "draft"],
  ];
  return <div className="space-y-5">
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold text-primary">Ready to draft</h3><p className="text-sm text-muted-foreground">{done} of {required.length} required details complete</p></div><span className="text-2xl font-semibold text-primary">{percent}%</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary transition-all" style={{ width: percent + "%" }} /></div>
      <ul className="mt-4 grid gap-1.5 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {readiness.map((item) => <li key={item.label}><button type="button" onClick={() => onGo(item.tab)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary">
          {item.done ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.optional ? "bg-muted-foreground/40" : "bg-amber-500")} />}
          <span className={cn("min-w-0", item.done ? "text-muted-foreground" : "text-foreground")}>{item.label}{item.optional ? <span className="text-muted-foreground"> (optional)</span> : null}</span>
        </button></li>)}
      </ul>
    </section>

    <section className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
      {facts.map(([label, value, target]) => <button key={label} type="button" onClick={() => onGo(target)} className="min-w-0 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/35">
        <span className="block text-xs text-muted-foreground">{label}</span><span className="mt-1 block text-base font-semibold leading-6 text-primary sm:text-lg">{value}</span>
      </button>)}
    </section>

    {checks.length ? <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-semibold text-amber-950"><CircleAlert className="size-4" /> Checks before signing ({checks.length})</h3>
      <ul className="mt-2 space-y-1.5 text-sm">{checks.map((check) => <li key={check.id}><button type="button" onClick={() => onGo(check.tab)} className={cn("w-full rounded-md px-2 py-1 text-left hover:bg-amber-100/60", check.severity === "error" ? "text-destructive" : "text-amber-950")}>{check.severity === "error" ? "Problem: " : ""}{check.message}</button></li>)}</ul>
    </section> : null}

    <AiReview deedId={deed.id} aiEnabled={aiEnabled} onGo={onGo} />
  </div>;
}

const reviewTabs: Record<string, PremiumTab> = { parties: "parties", properties: "properties", title: "title", payments: "payments", terms: "terms", execution: "terms", documents: "documents" };

function AiReview({ deedId, aiEnabled, onGo }: { deedId: string; aiEnabled: boolean; onGo: (tab: PremiumTab) => void }) {
  const [issues, setIssues] = useState<ReviewIssue[] | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const result = await reviewDeed({ deedId });
    if (result.error !== undefined) return void toast.error(result.error);
    setIssues(result.issues);
  });
  return <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h3 className="flex items-center gap-2 font-semibold text-primary"><Sparkles className="size-4 text-accent-foreground" /> AI legal review</h3><p className="text-sm text-muted-foreground">An advocate-style check of the facts: consideration vs payments, TDS, title chain, areas, witnesses and risks for this deed type.</p></div>
      <Button type="button" variant="outline" className="h-9" disabled={!aiEnabled || pending} onClick={run}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {issues ? "Review again" : "Run review"}</Button>
    </div>
    {!aiEnabled ? <p className="mt-3 text-xs text-muted-foreground">Configure AI in Settings to use the review.</p> : null}
    {issues ? issues.length ? <ul className="mt-4 space-y-2">{issues.map((issue, position) => <li key={position}><button type="button" onClick={() => onGo(reviewTabs[issue.section] ?? "overview")} className="flex w-full items-start gap-2 rounded-lg border border-border p-3 text-left text-sm hover:border-primary/35">
      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", issue.severity === "high" ? "bg-red-50 text-red-700" : issue.severity === "medium" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700")}>{issue.severity}</span>
      <span className="min-w-0">{issue.message}</span>
    </button></li>)}</ul> : <p className="mt-4 text-sm text-emerald-700">No issues found in the matter facts. Review the draft text as well before signing.</p> : null}
  </section>;
}
