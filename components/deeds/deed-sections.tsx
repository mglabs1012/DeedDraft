"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { format } from "date-fns";
import {
  Banknote,
  Building2,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { paymentsTotal, maskAadhaar } from "@/lib/draft";
import {
  amountInWords,
  areaUnitLabels,
  formatINR,
  partyRoleLabels,
  paymentModeLabels,
  propertyKindLabels,
  type DeedType,
} from "@/lib/deeds";
import {
  considerationSchema,
  partySchema,
  paymentSchema,
  propertySchema,
  type Consideration,
  type DeedData,
  type Party,
  type PartyRole,
  type Payment,
  type Property,
} from "@/lib/schemas/deed-data";

export type SaveSection = <K extends keyof DeedData>(section: K, value: DeedData[K]) => Promise<boolean>;

const cardClass = "rounded-xl border border-border bg-card shadow-sm";

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <h2 className="font-semibold text-primary">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Empty({ icon: Icon, title, description, action }: { icon: typeof Users; title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold text-primary">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

function RowActions({ label, onEdit, onDelete, disabled }: { label: string; onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button aria-label={"Edit " + label} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-primary" disabled={disabled} onClick={onEdit} type="button">
        <Pencil className="size-4" />
      </button>
      <button aria-label={"Remove " + label} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={disabled} onClick={onDelete} type="button">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function useListEditor<T extends { id: string }>(items: T[], save: (next: T[]) => Promise<boolean>) {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  const upsert = (item: T) =>
    startTransition(async () => {
      const exists = items.some((current) => current.id === item.id);
      const next = exists ? items.map((current) => (current.id === item.id ? item : current)) : items.concat(item);
      if (await save(next)) setEditing(null);
    });

  const remove = (item: T, label: string) => {
    if (!window.confirm("Remove " + label + "?")) return;
    startTransition(async () => {
      await save(items.filter((current) => current.id !== item.id));
    });
  };

  return { editing, setEditing, pending, upsert, remove };
}

function SubmitFooter({ formId, pending, onCancel, label }: { formId: string; pending: boolean; onCancel: () => void; label: string }) {
  return (
    <>
      <Button className="h-10" onClick={onCancel} type="button" variant="outline">Cancel</Button>
      <Button className="h-10" disabled={pending} form={formId} type="submit">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} {label}
      </Button>
    </>
  );
}

/* ----------------------------------------------------------------- Parties */

export function PartiesSection({ deedType, parties, save }: { deedType: DeedType; parties: Party[]; save: SaveSection }) {
  const roles = partyRoleLabels[deedType];
  const editor = useListEditor(parties, (next) => save("parties", next));
  const [defaultRole, setDefaultRole] = useState<PartyRole>("first");
  const order: PartyRole[] = ["first", "second", "other", "witness"];

  const add = (role: PartyRole) => {
    setDefaultRole(role);
    editor.setEditing("new");
  };

  return (
    <section className={cardClass}>
      <SectionHeader
        action={<Button className="h-9" onClick={() => add("first")} type="button"><Plus className="size-4" /> Add party</Button>}
        description={roles.first + ", " + roles.second.toLowerCase() + " and witnesses to this deed."}
        title="Parties"
      />
      {parties.length ? (
        <div className="divide-y divide-border">
          {order.map((role) => {
            const group = parties.filter((party) => party.role === role);
            return (
              <div className="px-4 py-4 sm:px-5" key={role}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-primary">
                    {roles[role]} <span className="font-normal text-muted-foreground">({group.length})</span>
                  </h3>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" onClick={() => add(role)} type="button">
                    <Plus className="size-3.5" /> Add
                  </button>
                </div>
                {group.length ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {group.map((party) => (
                      <article className="flex gap-3 rounded-lg border border-border p-3 sm:p-4" key={party.id}>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                          <UserRound className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-primary">{party.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {[party.relativeName ? party.relation + " " + party.relativeName : "", party.age ? party.age + " yrs" : "", party.occupation].filter(Boolean).join(" · ") || "Details pending"}
                          </p>
                          {party.address ? <p className="mt-1 text-sm leading-5 text-foreground/80">{party.address}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                            {party.aadhaar ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">Aadhaar {maskAadhaar(party.aadhaar)}</span> : null}
                            {party.pan ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">PAN {party.pan}</span> : null}
                            {party.phone ? <span className="rounded bg-secondary px-2 py-0.5">{party.phone}</span> : null}
                          </div>
                        </div>
                        <RowActions disabled={editor.pending} label={party.fullName} onDelete={() => editor.remove(party, party.fullName)} onEdit={() => editor.setEditing(party)} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">None added.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          action={<Button className="h-9" onClick={() => add("first")} type="button"><Plus className="size-4" /> Add first party</Button>}
          description={"Add the " + roles.first.toLowerCase() + ", " + roles.second.toLowerCase() + " and at least two witnesses."}
          icon={Users}
          title="No parties yet"
        />
      )}
      <Modal
        footer={<SubmitFooter formId="party-form" label="Save party" onCancel={() => editor.setEditing(null)} pending={editor.pending} />}
        onClose={() => editor.setEditing(null)}
        open={editor.editing !== null}
        title={editor.editing === "new" ? "Add party" : "Edit party"}
        className="sm:max-w-2xl"
      >
        {editor.editing !== null ? (
          <PartyForm
            initial={editor.editing === "new" ? undefined : editor.editing}
            defaultRole={defaultRole}
            key={editor.editing === "new" ? "new" : editor.editing.id}
            onSubmit={editor.upsert}
            roles={roles}
          />
        ) : null}
      </Modal>
    </section>
  );
}

function PartyForm({ initial, defaultRole, roles, onSubmit }: { initial?: Party; defaultRole: PartyRole; roles: Record<PartyRole, string>; onSubmit: (party: Party) => void }) {
  const form = useForm<z.input<typeof partySchema>, unknown, Party>({
    resolver: zodResolver(partySchema),
    defaultValues: initial ?? {
      id: crypto.randomUUID(),
      role: defaultRole,
      fullName: "",
      relation: "S/o" as const,
      relativeName: "",
      age: "",
      occupation: "",
      address: "",
      aadhaar: "",
      pan: "",
      phone: "",
    },
  });
  const errors = form.formState.errors;

  return (
    <form className="grid gap-4 sm:grid-cols-2" id="party-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Role">
        <select className={inputClass} {...form.register("role")}>
          {(Object.keys(roles) as PartyRole[]).map((role) => <option key={role} value={role}>{roles[role]}</option>)}
        </select>
      </Field>
      <Field error={errors.fullName?.message} label="Full name">
        <input className={inputClass} placeholder="e.g. Ramesh Kumar Sharma" {...form.register("fullName")} />
      </Field>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 sm:col-span-2">
        <Field label="Relation">
          <select className={inputClass} {...form.register("relation")}>
            {["S/o", "D/o", "W/o", "C/o"].map((relation) => <option key={relation}>{relation}</option>)}
          </select>
        </Field>
        <Field error={errors.relativeName?.message} label="Father / husband name">
          <input className={inputClass} {...form.register("relativeName")} />
        </Field>
      </div>
      <Field error={errors.age?.message} label="Age" hint="years">
        <input className={inputClass} inputMode="numeric" {...form.register("age")} />
      </Field>
      <Field error={errors.occupation?.message} label="Occupation">
        <input className={inputClass} placeholder="e.g. Agriculture, Service" {...form.register("occupation")} />
      </Field>
      <Field className="sm:col-span-2" error={errors.address?.message} label="Residential address">
        <textarea className={textareaClass + " min-h-20"} {...form.register("address")} />
      </Field>
      <Field error={errors.aadhaar?.message} hint="optional" label="Aadhaar">
        <input className={inputClass + " font-mono"} inputMode="numeric" placeholder="1234 5678 9012" {...form.register("aadhaar")} />
      </Field>
      <Field error={errors.pan?.message} hint="optional" label="PAN">
        <input className={inputClass + " font-mono uppercase"} placeholder="ABCDE1234F" {...form.register("pan")} />
      </Field>
      <Field error={errors.phone?.message} hint="optional" label="Phone">
        <input className={inputClass} inputMode="tel" type="tel" {...form.register("phone")} />
      </Field>
      <p className="self-end text-xs leading-5 text-muted-foreground sm:pb-2">Aadhaar is masked to the last four digits in drafts.</p>
    </form>
  );
}

/* -------------------------------------------------------------- Properties */

export function PropertiesSection({ properties, save }: { properties: Property[]; save: SaveSection }) {
  const editor = useListEditor(properties, (next) => save("properties", next));
  const add = () => editor.setEditing("new");

  return (
    <section className={cardClass}>
      <SectionHeader
        action={<Button className="h-9" onClick={add} type="button"><Plus className="size-4" /> Add property</Button>}
        description="Each item appears in the Schedule of Property with its boundaries."
        title="Property schedule"
      />
      {properties.length ? (
        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
          {properties.map((property, index) => (
            <article className="rounded-lg border border-border p-4" key={property.id}>
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-accent-foreground">
                  <Building2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item {index + 1} · {propertyKindLabels[property.kind]}</p>
                  <p className="mt-1 font-semibold leading-6 text-primary">{property.description}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[property.identifier, property.area ? property.area.toLocaleString("en-IN") + " " + areaUnitLabels[property.areaUnit] : ""].filter(Boolean).join(" · ")}
                  </p>
                  {property.locality || property.district ? (
                    <p className="mt-1 flex items-start gap-1 text-sm text-foreground/80">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      {[property.locality, property.tehsil, property.district, property.state].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                </div>
                <RowActions disabled={editor.pending} label={"item " + (index + 1)} onDelete={() => editor.remove(property, "item " + (index + 1))} onEdit={() => editor.setEditing(property)} />
              </div>
              <div className="mt-4 grid grid-cols-3 grid-rows-3 gap-1 text-center text-[11px] leading-4 sm:text-xs">
                <span />
                <Boundary label="N" value={property.north} />
                <span />
                <Boundary label="W" value={property.west} />
                <span className="grid place-items-center rounded-md bg-primary/90 p-2 font-semibold text-primary-foreground">Property</span>
                <Boundary label="E" value={property.east} />
                <span />
                <Boundary label="S" value={property.south} />
                <span />
              </div>
              {property.marketValue ? <p className="mt-3 text-xs text-muted-foreground">DLC market value: <span className="font-semibold text-primary">{formatINR(property.marketValue)}</span></p> : null}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          action={<Button className="h-9" onClick={add} type="button"><Plus className="size-4" /> Add property</Button>}
          description="Add the plot, house, flat or land along with its khasra / plot number, area and four boundaries."
          icon={Building2}
          title="No property added"
        />
      )}
      <Modal
        className="sm:max-w-2xl"
        footer={<SubmitFooter formId="property-form" label="Save property" onCancel={() => editor.setEditing(null)} pending={editor.pending} />}
        onClose={() => editor.setEditing(null)}
        open={editor.editing !== null}
        title={editor.editing === "new" ? "Add property" : "Edit property"}
      >
        {editor.editing !== null ? (
          <PropertyForm initial={editor.editing === "new" ? undefined : editor.editing} key={editor.editing === "new" ? "new" : editor.editing.id} onSubmit={editor.upsert} />
        ) : null}
      </Modal>
    </section>
  );
}

function Boundary({ label, value }: { label: string; value?: string }) {
  return (
    <span className="flex min-w-0 flex-col justify-center rounded-md border border-border bg-secondary/40 p-1.5">
      <strong className="text-primary">{label}</strong>
      <span className="line-clamp-2 break-words text-muted-foreground">{value || "—"}</span>
    </span>
  );
}

function PropertyForm({ initial, onSubmit }: { initial?: Property; onSubmit: (property: Property) => void }) {
  const form = useForm<z.input<typeof propertySchema>, unknown, Property>({
    resolver: zodResolver(propertySchema),
    defaultValues: initial ?? {
      id: crypto.randomUUID(),
      kind: "plot" as const,
      description: "",
      identifier: "",
      area: "",
      areaUnit: "sq_yd" as const,
      locality: "",
      tehsil: "",
      district: "",
      state: "Rajasthan",
      north: "",
      south: "",
      east: "",
      west: "",
      marketValue: "",
    },
  });
  const errors = form.formState.errors;

  return (
    <form className="grid gap-4 sm:grid-cols-2" id="property-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Property type">
        <select className={inputClass} {...form.register("kind")}>
          {Object.entries(propertyKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field error={errors.identifier?.message} label="Plot / khasra / house no.">
        <input className={inputClass} placeholder="e.g. Plot No. 12, Khasra No. 245/2" {...form.register("identifier")} />
      </Field>
      <Field className="sm:col-span-2" error={errors.description?.message} label="Description">
        <textarea className={textareaClass + " min-h-20"} placeholder="e.g. Residential plot with boundary wall in Vaishali Nagar scheme" {...form.register("description")} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
        <Field error={errors.area?.message} label="Area">
          <input className={inputClass} inputMode="decimal" {...form.register("area")} />
        </Field>
        <Field label="Unit">
          <select className={inputClass} {...form.register("areaUnit")}>
            {Object.entries(areaUnitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      <Field error={errors.marketValue?.message} hint="₹, optional" label="DLC market value">
        <input className={inputClass} inputMode="decimal" {...form.register("marketValue")} />
      </Field>
      <Field label="Village / colony">
        <input className={inputClass} {...form.register("locality")} />
      </Field>
      <Field label="Tehsil">
        <input className={inputClass} {...form.register("tehsil")} />
      </Field>
      <Field label="District">
        <input className={inputClass} {...form.register("district")} />
      </Field>
      <Field label="State">
        <input className={inputClass} {...form.register("state")} />
      </Field>
      <fieldset className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-primary">Boundaries (चौहद्दी)</legend>
        {(["north", "south", "east", "west"] as const).map((side) => (
          <Field key={side} label={side[0].toUpperCase() + side.slice(1)}>
            <input className={inputClass} placeholder={side === "north" ? "e.g. 30 ft road" : "e.g. Plot No. 13"} {...form.register(side)} />
          </Field>
        ))}
      </fieldset>
    </form>
  );
}

/* ---------------------------------------------------------------- Payments */

export function PaymentsSection({ consideration, payments, save }: { consideration: Consideration; payments: Payment[]; save: SaveSection }) {
  const editor = useListEditor(payments, (next) => save("payments", next));
  const paid = paymentsTotal({ parties: [], properties: [], consideration, payments });
  const total = consideration.total ?? 0;
  const balance = total - paid;
  const percent = total ? Math.min((paid / total) * 100, 100) : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-6">
        <ConsiderationCard consideration={consideration} save={save} />
        <section className={cardClass + " p-4 sm:p-5"}>
          <h2 className="font-semibold text-primary">Payment status</h2>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div className={"h-full rounded-full " + (balance <= 0 && total ? "bg-emerald-600" : "bg-accent")} style={{ width: percent + "%" }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-secondary/60 p-3"><dt className="text-muted-foreground">Received</dt><dd className="mt-1 font-semibold text-primary">{formatINR(paid)}</dd></div>
            <div className="rounded-lg bg-secondary/60 p-3"><dt className="text-muted-foreground">{balance < 0 ? "Excess" : "Balance"}</dt><dd className={"mt-1 font-semibold " + (balance === 0 && total ? "text-emerald-700" : balance < 0 ? "text-destructive" : "text-amber-700")}>{formatINR(Math.abs(balance))}</dd></div>
          </dl>
          {!total ? <p className="mt-3 text-xs text-muted-foreground">Enter the total consideration to track the balance.</p> : null}
        </section>
      </div>

      <section className={cardClass}>
        <SectionHeader
          action={<Button className="h-9" onClick={() => editor.setEditing("new")} type="button"><Plus className="size-4" /> Add payment</Button>}
          description="Cheque, RTGS/NEFT, UPI and cash payments recited in the deed."
          title="Payments"
        />
        {payments.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-semibold">Mode</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Bank</th><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 text-right font-semibold">Amount</th><th className="px-5 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((payment) => (
                    <tr className="hover:bg-secondary/40" key={payment.id}>
                      <td className="px-5 py-3 font-medium text-primary">{paymentModeLabels[payment.mode]}</td>
                      <td className="px-5 py-3 font-mono text-xs">{payment.reference || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{payment.bank || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{payment.date ? format(new Date(payment.date), "d MMM yyyy") : "—"}</td>
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
                    <p className="text-sm text-muted-foreground">{[paymentModeLabels[payment.mode], payment.reference, payment.date ? format(new Date(payment.date), "d MMM yyyy") : ""].filter(Boolean).join(" · ")}</p>
                    {payment.bank ? <p className="text-xs text-muted-foreground">{payment.bank}</p> : null}
                  </div>
                  <RowActions disabled={editor.pending} label="payment" onDelete={() => editor.remove(payment, "this payment")} onEdit={() => editor.setEditing(payment)} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <Empty
            action={<Button className="h-9" onClick={() => editor.setEditing("new")} type="button"><Plus className="size-4" /> Add payment</Button>}
            description="Record each instalment with its cheque number or UTR so the deed recites the payment trail accurately."
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
          <PaymentForm initial={editor.editing === "new" ? undefined : editor.editing} key={editor.editing === "new" ? "new" : editor.editing.id} onSubmit={editor.upsert} />
        ) : null}
      </Modal>
    </div>
  );
}

function ConsiderationCard({ consideration, save }: { consideration: Consideration; save: SaveSection }) {
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(considerationSchema),
    defaultValues: {
      total: consideration.total ?? "",
      stampDuty: consideration.stampDuty ?? "",
      registrationFee: consideration.registrationFee ?? "",
    },
  });
  const errors = form.formState.errors;
  const total = Number(form.watch("total")) || 0;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (await save("consideration", values)) form.reset(form.getValues());
    }),
  );

  return (
    <form className={cardClass + " p-4 sm:p-5"} noValidate onSubmit={submit}>
      <h2 className="font-semibold text-primary">Consideration</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Amounts recited in the deed.</p>
      <div className="mt-4 space-y-4">
        <Field error={errors.total?.message} hint="₹" label="Total consideration">
          <input className={inputClass + " text-base font-semibold"} inputMode="decimal" {...form.register("total")} />
        </Field>
        {total ? <p className="-mt-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs leading-5 text-secondary-foreground">Rupees {amountInWords(total)} Only</p> : null}
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

function PaymentForm({ initial, onSubmit }: { initial?: Payment; onSubmit: (payment: Payment) => void }) {
  const form = useForm<z.input<typeof paymentSchema>, unknown, Payment>({
    resolver: zodResolver(paymentSchema),
    defaultValues: initial ?? { id: crypto.randomUUID(), mode: "cheque" as const, amount: "", date: "", reference: "", bank: "", notes: "" },
  });
  const errors = form.formState.errors;

  return (
    <form className="grid gap-4 sm:grid-cols-2" id="payment-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Mode">
        <select className={inputClass} {...form.register("mode")}>
          {Object.entries(paymentModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field error={errors.amount?.message} hint="₹" label="Amount">
        <input className={inputClass} inputMode="decimal" {...form.register("amount")} />
      </Field>
      <Field label="Cheque no. / UTR">
        <input className={inputClass + " font-mono"} {...form.register("reference")} />
      </Field>
      <Field label="Date">
        <input className={inputClass} type="date" {...form.register("date")} />
      </Field>
      <Field className="sm:col-span-2" label="Bank & branch">
        <input className={inputClass} placeholder="e.g. State Bank of India, C-Scheme, Jaipur" {...form.register("bank")} />
      </Field>
      <Field className="sm:col-span-2" hint="optional" label="Notes">
        <input className={inputClass} {...form.register("notes")} />
      </Field>
    </form>
  );
}
