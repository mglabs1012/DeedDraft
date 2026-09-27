"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Building, Plus, UserRound, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { displayName, formatAadhaar } from "@/lib/drafting/format";
import { partySchema, type Party, type PartyRole } from "@/lib/schemas/deed-data";

import { CheckboxField, Empty, FormGroup, RowActions, SectionHeader, SubmitFooter, cardClass, useListEditor, type SaveSection } from "./shared";

const order: PartyRole[] = ["first", "second", "other", "witness"];

export function PartiesSection({ deedType, parties, save }: { deedType: DeedType; parties: Party[]; save: SaveSection }) {
  const roles = getDeedType(deedType).roles;
  const editor = useListEditor(parties, (next) => save("parties", next));
  const [defaultRole, setDefaultRole] = useState<PartyRole>("first");

  const add = (role: PartyRole) => {
    setDefaultRole(role);
    editor.setEditing("new");
  };

  return (
    <section className={cardClass}>
      <SectionHeader
        action={<Button className="h-9" onClick={() => add("first")} type="button"><Plus className="size-4" /> Add party</Button>}
        description={roles.first.en + " (" + roles.first.hi.m + "), " + roles.second.en.toLowerCase() + " (" + roles.second.hi.m + ") and witnesses."}
        title="Parties"
      />
      {parties.length ? (
        <div className="divide-y divide-border">
          {order.map((role) => {
            const group = parties.filter((party) => party.role === role);
            if (role === "other" && !group.length) return null;
            return (
              <div className="px-4 py-4 sm:px-5" key={role}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-primary">
                    {roles[role].en} <span className="font-devanagari font-normal text-muted-foreground">· {roles[role].hi.m}</span> <span className="font-normal text-muted-foreground">({group.length})</span>
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
                          {party.organisation ? <Building className="size-4" /> : <UserRound className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          {party.organisation ? <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">M/s. {party.organisation}</p> : null}
                          <p className="break-words font-semibold text-primary">{displayName(party, "hindi")}{party.alias ? <span className="font-normal text-muted-foreground"> उर्फ {party.alias}</span> : null}</p>
                          <p className="text-sm text-muted-foreground">
                            {[party.relativeName ? party.relation + " " + (party.relativeDeceased ? "Late " : "") + party.relativeName : "", party.age ? party.age + " yrs" : "", party.caste, party.occupation].filter(Boolean).join(" · ") || "Details pending"}
                          </p>
                          {party.address ? <p className="mt-1 text-sm leading-5 text-foreground/80">{party.address}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                            {party.aadhaar ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">Aadhaar {formatAadhaar(party.aadhaar, true)}</span> : null}
                            {party.pan ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">PAN {party.pan}</span> : null}
                            {party.gstin ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">GSTIN {party.gstin}</span> : null}
                            {party.phone ? <span className="rounded bg-secondary px-2 py-0.5">{party.phone}</span> : null}
                            {party.representedBy ? <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">Through representative</span> : null}
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
          action={<Button className="h-9" onClick={() => add("first")} type="button"><Plus className="size-4" /> Add {roles.first.en.toLowerCase()}</Button>}
          description={"Add the " + roles.first.en.toLowerCase() + ", " + roles.second.en.toLowerCase() + " and two witnesses. For Hindi drafts, type names and addresses in Hindi."}
          icon={Users}
          title="No parties yet"
        />
      )}
      <Modal
        className="sm:max-w-3xl"
        footer={<SubmitFooter formId="party-form" label="Save party" onCancel={() => editor.setEditing(null)} pending={editor.pending} />}
        onClose={() => editor.setEditing(null)}
        open={editor.editing !== null}
        title={editor.editing === "new" ? "Add party" : "Edit party"}
      >
        {editor.editing !== null ? (
          <PartyForm
            defaultRole={defaultRole}
            initial={editor.editing === "new" ? undefined : editor.editing}
            key={editor.editing === "new" ? "new" : editor.editing.id}
            onSubmit={editor.upsert}
            roleLabels={Object.fromEntries(order.map((role) => [role, roles[role].en + " · " + roles[role].hi.m])) as Record<PartyRole, string>}
          />
        ) : null}
      </Modal>
    </section>
  );
}

function PartyForm({ initial, defaultRole, roleLabels, onSubmit }: { initial?: Party; defaultRole: PartyRole; roleLabels: Record<PartyRole, string>; onSubmit: (party: Party) => void }) {
  const form = useForm<z.input<typeof partySchema>, unknown, Party>({
    resolver: zodResolver(partySchema),
    defaultValues: initial ?? {
      id: crypto.randomUUID(),
      role: defaultRole,
      salutation: "auto",
      fullName: "",
      alias: "",
      gender: "male",
      relation: "S/o",
      relativeName: "",
      relativeDeceased: false,
      age: "",
      caste: "",
      occupation: "",
      address: "",
      aadhaar: "",
      pan: "",
      phone: "",
      email: "",
      organisation: "",
      gstin: "",
      capacity: "",
      representedBy: "",
    },
  });
  const errors = form.formState.errors;
  const [showOrg, setShowOrg] = useState(Boolean(initial?.organisation || initial?.representedBy));

  return (
    <form className="space-y-4" id="party-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FormGroup title="Identity">
        <Field label="Role">
          <select className={inputClass} {...form.register("role")}>
            {order.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Gender" hint="for Hindi terms">
            <select className={inputClass} {...form.register("gender")}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Title">
            <select className={inputClass} {...form.register("salutation")}>
              <option value="auto">Auto (श्री / श्रीमती)</option>
              <option value="shri">श्री</option>
              <option value="smt">श्रीमती</option>
              <option value="sushri">सुश्री</option>
              <option value="kumari">कुमारी</option>
              <option value="none">None</option>
            </select>
          </Field>
        </div>
        <Field error={errors.fullName?.message} label="Full name">
          <input className={inputClass} placeholder="e.g. केसर देवी गुसाईवाल" {...form.register("fullName")} />
        </Field>
        <Field hint="उर्फ, optional" label="Alias">
          <input className={inputClass} {...form.register("alias")} />
        </Field>
        <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 sm:col-span-2">
          <Field label="Relation">
            <select
              className={inputClass}
              {...form.register("relation", {
                onChange: (event) => {
                  if (event.target.value === "W/o" || event.target.value === "D/o") form.setValue("gender", "female");
                },
              })}
            >
              <option value="S/o">S/o पुत्र</option>
              <option value="D/o">D/o पुत्री</option>
              <option value="W/o">W/o पत्नी</option>
              <option value="C/o">C/o द्वारा</option>
            </select>
          </Field>
          <Field error={errors.relativeName?.message} label="Father / husband name">
            <input className={inputClass} placeholder="e.g. रमेश चन्द्र गुसाईवाल" {...form.register("relativeName")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <CheckboxField label="Father / husband is deceased" hint="Drafts will read “स्व. श्री” / “Late Shri”." {...form.register("relativeDeceased")} />
        </div>
      </FormGroup>

      <FormGroup title="Particulars">
        <div className="grid grid-cols-2 gap-2">
          <Field error={errors.age?.message} hint="years" label="Age">
            <input className={inputClass} inputMode="numeric" {...form.register("age")} />
          </Field>
          <Field label="Caste" hint="जाति">
            <input className={inputClass} {...form.register("caste")} />
          </Field>
        </div>
        <Field label="Occupation">
          <input className={inputClass} placeholder="e.g. गृहिणी, व्यवसाय" {...form.register("occupation")} />
        </Field>
        <Field className="sm:col-span-2" error={errors.address?.message} label="Residential address">
          <textarea className={textareaClass + " min-h-20"} placeholder="e.g. मकान नम्बर 374, अर्जुन लाल सेठी नगर, परबतपुरा, अजमेर (राज.)" {...form.register("address")} />
        </Field>
        <Field error={errors.aadhaar?.message} hint="optional" label="Aadhaar">
          <input className={inputClass + " font-mono"} inputMode="numeric" placeholder="1234 5678 9012" {...form.register("aadhaar")} />
        </Field>
        <Field error={errors.pan?.message} hint="optional" label="PAN">
          <input className={inputClass + " font-mono uppercase"} placeholder="ABCDE1234F" {...form.register("pan")} />
        </Field>
        <Field error={errors.phone?.message} hint="optional" label="Mobile">
          <input className={inputClass} inputMode="tel" type="tel" {...form.register("phone")} />
        </Field>
        <Field error={errors.email?.message} hint="optional" label="Email">
          <input className={inputClass} inputMode="email" type="email" {...form.register("email")} />
        </Field>
      </FormGroup>

      {showOrg ? (
        <FormGroup description="firm, company or POA holder" title="Organisation / representation">
          <Field label="Firm / company name" hint="optional">
            <input className={inputClass} placeholder="e.g. Saarthi Dream" {...form.register("organisation")} />
          </Field>
          <Field error={errors.gstin?.message} hint="optional" label="GSTIN">
            <input className={inputClass + " font-mono uppercase"} placeholder="08ABCDE1234F1Z5" {...form.register("gstin")} />
          </Field>
          <Field hint="e.g. Proprietor, Director" label="Signing capacity">
            <input className={inputClass} {...form.register("capacity")} />
          </Field>
          <Field className="sm:col-span-2" hint="GPA holder and registration details" label="Represented by">
            <textarea className={textareaClass + " min-h-16"} placeholder="e.g. GPA holder Sh. Manoj Parihar, registered GPA dated 06.07.2024, Sub-Registrar Ajmer-II, Book 4, Volume 23, Page 109" {...form.register("representedBy")} />
          </Field>
        </FormGroup>
      ) : (
        <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setShowOrg(true)} type="button">
          + Firm, company or power-of-attorney details
        </button>
      )}
    </form>
  );
}
