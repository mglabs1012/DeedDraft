"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { BookOpen, Check, LoaderCircle, Plus, Save } from "lucide-react";

import { ClauseAssistant } from "@/components/deeds/ai/clause-assistant";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { formatINR, type DeedLanguage } from "@/lib/deeds";
import { rentSchedule } from "@/lib/drafting";
import { clauseLibrary } from "@/lib/drafting/clause-library";
import { englishLongDate, shortDate, termEndDate } from "@/lib/drafting/hindi";
import { executionSchema, termsSchema, type Execution, type Terms } from "@/lib/schemas/deed-data";

import { CheckboxField, FormGroup, cardClass, type SaveSection } from "./shared";

type AiProps = { aiEnabled?: boolean; deedId?: string; deedLanguage?: DeedLanguage };

export function TermsSection({ deedType, terms, execution, firmCity, save, aiEnabled, deedId, deedLanguage }: { deedType: DeedType; terms: Terms; execution: Execution; firmCity: string; save: SaveSection } & AiProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <TermsCard aiEnabled={aiEnabled} deedId={deedId} deedLanguage={deedLanguage} deedType={deedType} key={JSON.stringify(terms)} save={save} terms={terms} />
      <ExecutionCard deedType={deedType} execution={execution} firmCity={firmCity} key={JSON.stringify(execution)} save={save} />
    </div>
  );
}

function SaveButton({ pending, dirty, label }: { pending: boolean; dirty: boolean; label: string }) {
  return (
    <Button className="h-10 w-full sm:w-auto" disabled={pending || !dirty} type="submit">
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} {label}
    </Button>
  );
}

const blankTerms = (terms: Terms): z.input<typeof termsSchema> => {
  const values: Record<string, unknown> = { ...terms };
  for (const key of Object.keys(termsSchema.shape)) if (values[key] === undefined) values[key] = "";
  values.forfeitOnBuyerDefault = terms.forfeitOnBuyerDefault;
  values.arbitration = terms.arbitration;
  return values as z.input<typeof termsSchema>;
};

function TermsCard({ deedType, terms, save, aiEnabled, deedId, deedLanguage = "hindi" }: { deedType: DeedType; terms: Terms; save: SaveSection } & AiProps) {
  const kind = getDeedType(deedType).terms;
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof termsSchema>, unknown, Terms>({ resolver: zodResolver(termsSchema), defaultValues: blankTerms(terms) });
  const errors = form.formState.errors;
  const submit = form.handleSubmit((values) => startTransition(async () => void (await save("terms", values))));
  const roles = getDeedType(deedType).roles;

  const watched = form.watch();
  const preview = kind === "tenancy" ? rentSchedule(termsSchema.safeParse(watched).data ?? terms) : [];
  const end = kind === "tenancy" ? termEndDate(String(watched.startDate ?? ""), Number(watched.termMonths) || undefined) : undefined;

  return (
    <form className={cardClass + " space-y-4 p-4 sm:p-5"} noValidate onSubmit={submit}>
      <div>
        <h2 className="font-semibold text-primary">{getDeedType(deedType).label} terms</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">These become the operative clauses of the draft.</p>
      </div>

      {kind === "agreement" ? (
        <FormGroup title="Balance & default">
          <Field hint="e.g. 1 माह, 60 days" label="Balance payable within">
            <input className={inputClass} {...form.register("balanceDue")} />
          </Field>
          <Field error={errors.balanceDueDate?.message} hint="or a fixed date" label="Balance due by">
            <input className={inputClass} type="date" {...form.register("balanceDueDate")} />
          </Field>
          <Field className="sm:col-span-2" label={"If the " + roles.first.en.toLowerCase() + " defaults"}>
            <select className={inputClass} {...form.register("sellerDefaultRemedy")}>
              <option value="either">Buyer may seek specific performance or double the earnest (buyer&apos;s option)</option>
              <option value="double">Seller refunds double the earnest money</option>
              <option value="specific">Buyer may seek specific performance</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <CheckboxField hint="साई राशि जब्त की जायेगी" label="Forfeit earnest money if the buyer fails to pay the balance" {...form.register("forfeitOnBuyerDefault")} />
          </div>
          <Field hint="optional" label="Existing loan on property with">
            <input className={inputClass} placeholder="e.g. भारतीय स्टेट बैंक, शाखा अजमेर" {...form.register("existingLoanBank")} />
          </Field>
          <Field hint="optional" label="Buyer's loan from">
            <input className={inputClass} placeholder="e.g. State Bank of India" {...form.register("buyerLoanBank")} />
          </Field>
        </FormGroup>
      ) : null}

      {kind === "gift" || kind === "release" ? (
        <FormGroup title="Relationship">
          <Field className={kind === "gift" ? "sm:col-span-2" : ""} hint="e.g. पिता-पुत्री" label="Relationship between the parties">
            <input className={inputClass} {...form.register("relationship")} />
          </Field>
          {kind === "release" ? (
            <Field hint="e.g. 1/4 (एक चौथाई)" label="Share being released">
              <input className={inputClass} {...form.register("share")} />
            </Field>
          ) : null}
        </FormGroup>
      ) : null}

      {kind === "family" ? (
        <FormGroup title="Background">
          <Field className="sm:col-span-2" hint="optional recital" label={deedType === "will" ? "How the testator holds the property" : "How the property came to be jointly held"}>
            <textarea className={textareaClass + " min-h-20"} placeholder={deedType === "will" ? "e.g. स्वअर्जित सम्पत्ति" : "e.g. पिता स्व. श्री ... के देहान्त उपरान्त उत्तराधिकार में प्राप्त"} {...form.register("background")} />
          </Field>
        </FormGroup>
      ) : null}

      {kind === "tenancy" ? (
        <>
          <FormGroup title="Term & rent">
            <Field className="sm:col-span-2" label="Purpose of use">
              <input className={inputClass} placeholder="e.g. सिस टेक्नोलॉजीज का व्यवसाय / office of share brokerage" {...form.register("purpose")} />
            </Field>
            <Field error={errors.startDate?.message} label="Start date">
              <input className={inputClass} type="date" {...form.register("startDate")} />
            </Field>
            <Field error={errors.termMonths?.message} hint="months" label="Term">
              <input className={inputClass} inputMode="numeric" placeholder={deedType === "rent" ? "11" : "144"} {...form.register("termMonths")} />
            </Field>
            {end ? <p className="-mt-1 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-secondary-foreground sm:col-span-2">Ends on {englishLongDate(end, false)}</p> : null}
            <Field error={errors.monthlyRent?.message} hint="₹" label="Monthly rent">
              <input className={inputClass} inputMode="decimal" {...form.register("monthlyRent")} />
            </Field>
            <Field error={errors.rentDueDay?.message} hint="day of month" label="Rent due by">
              <input className={inputClass} inputMode="numeric" placeholder="10" {...form.register("rentDueDay")} />
            </Field>
            <Field className="sm:col-span-2" hint="optional" label="Owner's bank account for rent">
              <input className={inputClass} placeholder="e.g. भारतीय स्टेट बैंक शाखा केसरगंज, अजमेर, खाता संख्या 51013061787" {...form.register("rentAccount")} />
            </Field>
            <Field error={errors.securityDeposit?.message} hint="₹, interest-free" label="Security deposit">
              <input className={inputClass} inputMode="decimal" {...form.register("securityDeposit")} />
            </Field>
            <Field error={errors.rentFreeDays?.message} hint="days, optional" label="Rent-free fit-out">
              <input className={inputClass} inputMode="numeric" {...form.register("rentFreeDays")} />
            </Field>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <Field error={errors.escalationPercent?.message} hint="%" label="Escalation">
                <input className={inputClass} inputMode="decimal" placeholder="5" {...form.register("escalationPercent")} />
              </Field>
              <Field error={errors.escalationEveryYears?.message} hint="years" label="Every">
                <input className={inputClass} inputMode="numeric" placeholder="1" {...form.register("escalationEveryYears")} />
              </Field>
            </div>
            <Field error={errors.lockInMonths?.message} hint="months, optional" label="Lock-in">
              <input className={inputClass} inputMode="numeric" {...form.register("lockInMonths")} />
            </Field>
            <Field error={errors.noticeMonths?.message} hint="months" label="Notice period">
              <input className={inputClass} inputMode="numeric" placeholder="1" {...form.register("noticeMonths")} />
            </Field>
          </FormGroup>
          {preview.length > 1 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-secondary/50 text-muted-foreground"><tr><th className="px-3 py-2">Year</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2 text-right">Monthly rent</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {preview.slice(0, 15).map((row) => (
                    <tr key={row.year}><td className="px-3 py-1.5">{row.year}</td><td className="px-3 py-1.5">{row.from ? shortDate(row.from) : "—"}</td><td className="px-3 py-1.5">{row.to ? shortDate(row.to) : "—"}</td><td className="px-3 py-1.5 text-right font-semibold text-primary">{formatINR(row.rent)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <FormGroup title="Charges & disputes">
            <Field label="Electricity & water paid by">
              <select className={inputClass} {...form.register("utilitiesBy")}><option value="tenant">Tenant / lessee</option><option value="owner">Owner / lessor</option></select>
            </Field>
            <Field label="Maintenance by">
              <select className={inputClass} {...form.register("maintenanceBy")}><option value="tenant">Tenant / lessee</option><option value="owner">Owner / lessor</option></select>
            </Field>
            <Field label="Property tax paid by">
              <select className={inputClass} {...form.register("propertyTaxBy")}><option value="owner">Owner / lessor</option><option value="tenant">Tenant / lessee</option></select>
            </Field>
            <Field hint="city" label="Courts having jurisdiction">
              <input className={inputClass} placeholder="e.g. अजमेर" {...form.register("jurisdiction")} />
            </Field>
            <div className="sm:col-span-2">
              <CheckboxField hint="Arbitration and Conciliation Act, 1996" label="Refer disputes to a sole arbitrator first" {...form.register("arbitration")} />
            </div>
          </FormGroup>
        </>
      ) : null}

      <Field hint="one clause per line; added before the schedule" label="Additional clauses">
        <textarea className={textareaClass + " min-h-28"} placeholder="यह कि ..." {...form.register("additionalClauses")} />
      </Field>
      <ClauseLibrary
        current={String(watched.additionalClauses ?? "")}
        deedLanguage={deedLanguage}
        deedType={deedType}
        onAdd={(clause) => {
          const current = String(form.getValues("additionalClauses") ?? "").trim();
          form.setValue("additionalClauses", [current, clause].filter(Boolean).join("\n"), { shouldDirty: true });
        }}
      />
      {aiEnabled && deedId ? (
        <ClauseAssistant
          deedId={deedId}
          deedLanguage={deedLanguage}
          onInsert={(clauses) => {
            const current = String(form.getValues("additionalClauses") ?? "").trim();
            form.setValue("additionalClauses", [current, ...clauses].filter(Boolean).join("\n"), { shouldDirty: true });
          }}
        />
      ) : null}
      <SaveButton dirty={form.formState.isDirty} label="Save terms" pending={pending} />
    </form>
  );
}

/** Ready-made optional clauses for the deed type, drawn from registered precedents. */
function ClauseLibrary({ deedType, deedLanguage, current, onAdd }: { deedType: DeedType; deedLanguage: DeedLanguage; current: string; onAdd: (clause: string) => void }) {
  const clauses = clauseLibrary(deedType);
  const languages: ("hindi" | "english")[] = deedLanguage === "bilingual" ? ["hindi", "english"] : [deedLanguage];
  if (!clauses.length) return null;
  return (
    <details className="group rounded-lg border border-border bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-primary">
        <BookOpen className="size-4" /> Clause library <span className="font-normal text-muted-foreground">· {clauses.length} standard clauses</span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {clauses.map((clause) => (
          <li className="space-y-2 px-3 py-3" key={clause.id}>
            <p className="text-sm font-semibold text-primary">{clause.title}</p>
            {languages.map((language) => {
              const text = clause[language];
              const added = current.includes(text);
              return (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between" key={language}>
                  <p className="text-sm text-muted-foreground" lang={language === "hindi" ? "hi" : "en"}>{text}</p>
                  <Button className="shrink-0" disabled={added} onClick={() => onAdd(text)} size="sm" type="button" variant="outline">
                    {added ? <Check /> : <Plus />} {added ? "Added" : languages.length > 1 ? (language === "hindi" ? "Add हिंदी" : "Add English") : "Add"}
                  </Button>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ExecutionCard({ deedType, execution, firmCity, save }: { deedType: DeedType; execution: Execution; firmCity: string; save: SaveSection }) {
  const [pending, startTransition] = useTransition();
  const roles = getDeedType(deedType).roles;
  const form = useForm<z.input<typeof executionSchema>, unknown, Execution>({
    resolver: zodResolver(executionSchema),
    defaultValues: { ...execution, place: execution.place ?? "", date: execution.date ?? "", subRegistrarOffice: execution.subRegistrarOffice ?? "" },
  });
  const errors = form.formState.errors;
  const submit = form.handleSubmit((values) => startTransition(async () => void (await save("execution", values))));

  return (
    <form className={cardClass + " space-y-4 self-start p-4 sm:p-5"} noValidate onSubmit={submit}>
      <div>
        <h2 className="font-semibold text-primary">Execution & registration</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Where, when and how the deed is executed.</p>
      </div>
      <Field hint={"defaults to " + firmCity} label="Place of execution">
        <input className={inputClass} placeholder={firmCity} {...form.register("place")} />
      </Field>
      <Field error={errors.date?.message} hint="leave blank to fill by hand" label="Execution date">
        <input className={inputClass} type="date" {...form.register("date")} />
      </Field>
      <Field hint="उप पंजीयक" label="Sub-Registrar office">
        <input className={inputClass} placeholder="e.g. अजमेर (द्वितीय)" {...form.register("subRegistrarOffice")} />
      </Field>
      <Field label="Stamp & registration expenses borne by">
        <select className={inputClass} {...form.register("expensesBy")}>
          <option value="second">{roles.second.en}</option>
          <option value="first">{roles.first.en}</option>
          <option value="shared">Shared equally</option>
        </select>
      </Field>
      <div className="space-y-2">
        <CheckboxField hint="Printed above the heading in Hindi drafts" label="Start with ॐ" {...form.register("invocation")} />
        <CheckboxField hint="Show only the last 4 digits in the draft" label="Mask Aadhaar numbers" {...form.register("maskAadhaar")} />
        <CheckboxField hint="“संलग्न नक्शे में सुर्ख लाल रंग से दर्शाया गया है”" label="Site plan (naksha) attached" {...form.register("mapAttached")} />
      </div>
      <SaveButton dirty={form.formState.isDirty} label="Save execution details" pending={pending} />
    </form>
  );
}
