"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Banknote, Calculator, LoaderCircle, Plus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { amountInWords, formatINR, paymentModeLabels, paymentNatureLabels, type DeedType } from "@/lib/deeds";
import { shortDate } from "@/lib/drafting/hindi";
import { considerationSchema, paymentSchema, type Consideration, type Payment } from "@/lib/schemas/deed-data";
import { estimateStampDuty, stampCategoryLabels, type StampCategory } from "@/lib/stamp-duty";

import { Empty, RowActions, SectionHeader, SubmitFooter, cardClass, useListEditor, type SaveSection } from "./shared";

export function PaymentsSection({ deedType, consideration, payments, save }: { deedType: DeedType; consideration: Consideration; payments: Payment[]; save: SaveSection }) {
  const editor = useListEditor(payments, (next) => save("payments", next));
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const total = consideration.total ?? 0;
  const balance = total - paid;
  const percent = total ? Math.min((paid / total) * 100, 100) : 0;
  const isAgreement = deedType === "agreement_to_sell";

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-6">
        <ConsiderationCard consideration={consideration} key={JSON.stringify(consideration)} save={save} showEstimator={deedType === "sale" || deedType === "agreement_to_sell"} />
        <section className={cardClass + " p-4 sm:p-5"}>
          <h2 className="font-semibold text-primary">{isAgreement ? "Earnest & balance" : "Payment status"}</h2>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div className={"h-full rounded-full " + (balance <= 0 && total ? "bg-emerald-600" : "bg-accent")} style={{ width: percent + "%" }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-secondary/60 p-3"><dt className="text-muted-foreground">{isAgreement ? "Earnest received" : "Received"}</dt><dd className="mt-1 font-semibold text-primary">{formatINR(paid)}</dd></div>
            <div className="rounded-lg bg-secondary/60 p-3"><dt className="text-muted-foreground">{balance < 0 ? "Excess" : isAgreement ? "Balance at registration" : "Balance"}</dt><dd className={"mt-1 font-semibold " + (balance === 0 && total ? "text-emerald-700" : balance < 0 ? "text-destructive" : "text-amber-700")}>{formatINR(Math.abs(balance))}</dd></div>
          </dl>
          {!total ? <p className="mt-3 text-xs text-muted-foreground">Enter the total consideration to track the balance.</p> : null}
          {total && balance > 0 && deedType === "sale" ? <p className="mt-3 text-xs text-amber-700">A sale deed normally recites the full consideration as received. Record the remaining payments or check the total.</p> : null}
        </section>
      </div>

      <section className={cardClass}>
        <SectionHeader
          action={<Button className="h-9" onClick={() => editor.setEditing("new")} type="button"><Plus className="size-4" /> Add payment</Button>}
          description={isAgreement ? "Earnest money (साई) received on signing." : "Cash, cheque, RTGS/UTR, bank-loan cheques and TDS challans recited in the deed."}
          title="Payments"
        />
        {payments.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-semibold">Mode</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Bank / lender</th><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 text-right font-semibold">Amount</th><th className="px-5 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((payment) => (
                    <tr className="hover:bg-secondary/40" key={payment.id}>
                      <td className="px-5 py-3"><p className="font-medium text-primary">{paymentModeLabels[payment.mode]}</p><p className="text-xs text-muted-foreground">{paymentNatureLabels[payment.nature]}</p></td>
                      <td className="px-5 py-3 font-mono text-xs">{payment.reference || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{[payment.bank, payment.lender].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{payment.date ? shortDate(payment.date) : "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-primary">{formatINR(payment.amount)}</td>
                      <td className="px-3 py-2"><RowActions disabled={editor.pending} label="payment" onDelete={() => editor.remove(payment, "this payment")} onEdit={() => editor.setEditing(payment)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {payments.map((payment) => (
                <div className="flex items-start gap-3 px-4 py-3" key={payment.id}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-accent-foreground"><Banknote className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary">{formatINR(payment.amount)}</p>
                    <p className="text-sm text-muted-foreground">{[paymentModeLabels[payment.mode], payment.reference, payment.date ? shortDate(payment.date) : ""].filter(Boolean).join(" · ")}</p>
                    <p className="text-xs text-muted-foreground">{[paymentNatureLabels[payment.nature], payment.bank, payment.lender].filter(Boolean).join(" · ")}</p>
                  </div>
                  <RowActions disabled={editor.pending} label="payment" onDelete={() => editor.remove(payment, "this payment")} onEdit={() => editor.setEditing(payment)} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <Empty
            action={<Button className="h-9" onClick={() => editor.setEditing("new")} type="button"><Plus className="size-4" /> Add payment</Button>}
            description="Record each instalment with its cheque number, UTR or challan so the deed recites the payment trail exactly."
            icon={Banknote}
            title="No payments recorded"
          />
        )}
      </section>

      <Modal
        footer={<SubmitFooter formId="payment-form" label="Save payment" onCancel={() => editor.setEditing(null)} pending={editor.pending} />}
        onClose={() => editor.setEditing(null)}
        open={editor.editing !== null}
        title={editor.editing === "new" ? "Add payment" : "Edit payment"}
      >
        {editor.editing !== null ? (
          <PaymentForm defaultNature={isAgreement ? "earnest" : "payment"} initial={editor.editing === "new" ? undefined : editor.editing} key={editor.editing === "new" ? "new" : editor.editing.id} onSubmit={editor.upsert} />
        ) : null}
      </Modal>
    </div>
  );
}

function ConsiderationCard({ consideration, save, showEstimator }: { consideration: Consideration; save: SaveSection; showEstimator: boolean }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof considerationSchema>, unknown, Consideration>({
    resolver: zodResolver(considerationSchema),
    defaultValues: {
      total: consideration.total ?? "",
      marketValue: consideration.marketValue ?? "",
      stampDuty: consideration.stampDuty ?? "",
      registrationFee: consideration.registrationFee ?? "",
      stampCategory: consideration.stampCategory,
    },
  });
  const errors = form.formState.errors;
  const total = Number(form.watch("total")) || 0;
  const marketValue = Number(form.watch("marketValue")) || 0;
  const category = (form.watch("stampCategory") ?? "male") as StampCategory;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const estimate = estimateStampDuty({ consideration: total, marketValue, category });

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      await save("consideration", values);
    }),
  );

  const apply = () => {
    if (!estimate) return;
    form.setValue("stampDuty", estimate.totalStamp, { shouldDirty: true });
    form.setValue("registrationFee", estimate.registrationFee, { shouldDirty: true });
    form.setValue("stampCategory", category, { shouldDirty: true });
  };

  return (
    <form className={cardClass + " p-4 sm:p-5"} noValidate onSubmit={submit}>
      <h2 className="font-semibold text-primary">Consideration</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Amounts recited in the deed.</p>
      <div className="mt-4 space-y-4">
        <Field error={errors.total?.message} hint="₹" label="Total consideration">
          <input className={inputClass + " text-base font-semibold"} inputMode="decimal" {...form.register("total")} />
        </Field>
        {total ? <p className="-mt-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs leading-5 text-secondary-foreground">Rupees {amountInWords(total)} Only</p> : null}
        <Field error={errors.marketValue?.message} hint="₹, for stamp duty" label="DLC market value">
          <input className={inputClass} inputMode="decimal" {...form.register("marketValue")} />
        </Field>
        {showEstimator ? (
          <div className="rounded-lg border border-dashed border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Calculator className="size-4" /> Rajasthan stamp estimate</p>
              <button className="text-xs font-semibold text-primary hover:underline" onClick={() => setShowBreakdown((open) => !open)} type="button">{showBreakdown ? "Hide" : "Details"}</button>
            </div>
            <select className={inputClass + " mt-3"} {...form.register("stampCategory")}>
              {Object.entries(stampCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {estimate ? (
              <>
                <p className="mt-3 text-sm">Stamp duty <strong className="text-primary">{formatINR(estimate.totalStamp)}</strong> · Registration <strong className="text-primary">{formatINR(estimate.registrationFee)}</strong></p>
                {showBreakdown ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <li>{estimate.rate}% on {formatINR(estimate.base)} (higher of consideration and DLC) = {formatINR(estimate.duty)}</li>
                    {estimate.surcharges.map((item) => <li key={item.label}>+ {item.label}: {formatINR(item.amount)}</li>)}
                  </ul>
                ) : null}
                <Button className="mt-3 h-8 w-full" onClick={apply} type="button" variant="outline">Use these amounts</Button>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Enter the consideration or DLC value.</p>
            )}
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Estimate only; confirm current rates and concessions on the e-stamp / IGRS portal.</p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field error={errors.stampDuty?.message} hint="₹" label="Stamp duty">
            <input className={inputClass} inputMode="decimal" {...form.register("stampDuty")} />
          </Field>
          <Field error={errors.registrationFee?.message} hint="₹" label="Registration fee">
            <input className={inputClass} inputMode="decimal" {...form.register("registrationFee")} />
          </Field>
        </div>
        <Button className="h-10 w-full" disabled={pending || !form.formState.isDirty} type="submit">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save consideration
        </Button>
      </div>
    </form>
  );
}

function PaymentForm({ initial, defaultNature, onSubmit }: { initial?: Payment; defaultNature: Payment["nature"]; onSubmit: (payment: Payment) => void }) {
  const form = useForm<z.input<typeof paymentSchema>, unknown, Payment>({
    resolver: zodResolver(paymentSchema),
    defaultValues: initial ?? { id: crypto.randomUUID(), mode: "cheque", nature: defaultNature, amount: "", date: "", reference: "", bank: "", lender: "", notes: "" },
  });
  const errors = form.formState.errors;
  const mode = form.watch("mode");
  const nature = form.watch("nature");
  const referenceLabel = mode === "rtgs_neft" ? "UTR number" : mode === "tds_challan" ? "Challan number" : mode === "upi" ? "UPI reference" : mode === "cash" ? "Reference" : "Cheque / DD number";

  return (
    <form className="grid gap-4 sm:grid-cols-2" id="payment-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Nature">
        <select className={inputClass} {...form.register("nature")}>
          {Object.entries(paymentNatureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Mode">
        <select className={inputClass} {...form.register("mode")}>
          {Object.entries(paymentModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field error={errors.amount?.message} hint="₹" label="Amount">
        <input className={inputClass} inputMode="decimal" {...form.register("amount")} />
      </Field>
      <Field error={errors.date?.message} label="Date">
        <input className={inputClass} type="date" {...form.register("date")} />
      </Field>
      {mode !== "cash" ? (
        <Field label={referenceLabel}>
          <input className={inputClass + " font-mono"} {...form.register("reference")} />
        </Field>
      ) : null}
      {mode !== "cash" && mode !== "tds_challan" ? (
        <Field label="Bank & branch">
          <input className={inputClass} placeholder="e.g. भारतीय स्टेट बैंक, शाखा नाका मदार, अजमेर" {...form.register("bank")} />
        </Field>
      ) : null}
      {nature === "loan" ? (
        <Field className="sm:col-span-2" label="Loan sanctioned by">
          <input className={inputClass} placeholder="e.g. Easy Home Finance Limited" {...form.register("lender")} />
        </Field>
      ) : null}
      <Field className="sm:col-span-2" hint="optional" label="Notes">
        <input className={inputClass} {...form.register("notes")} />
      </Field>
    </form>
  );
}
