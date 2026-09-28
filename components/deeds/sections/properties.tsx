"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Building2, MapPin, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { getDeedType, type DeedType } from "@/lib/deed-types";
import { areaUnitLabels, formatINR, landUseLabels, propertyKindLabels } from "@/lib/deeds";
import { areaTriple, displayName } from "@/lib/drafting/format";
import { propertySchema, type Party, type Property } from "@/lib/schemas/deed-data";

import { CheckboxField, Empty, FormGroup, RowActions, SectionHeader, SubmitFooter, cardClass, useListEditor, type SaveSection } from "./shared";

export function PropertiesSection({ deedType, properties, parties, save }: { deedType: DeedType; properties: Property[]; parties: Party[]; save: SaveSection }) {
  const editor = useListEditor(properties, (next) => save("properties", next));
  const allotment = getDeedType(deedType).allotment;
  const allottees = parties.filter((party) => party.role === "first" || party.role === "second");
  const add = () => editor.setEditing("new");

  return (
    <section className={cardClass}>
      <SectionHeader
        action={<Button className="h-9" onClick={add} type="button"><Plus className="size-4" /> Add property</Button>}
        description="Each item appears in the schedule with its boundaries, side measurements and area in sq. m. = sq. yd. = sq. ft."
        title="Property schedule"
      />
      {properties.length ? (
        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
          {properties.map((property, index) => {
            const allottee = parties.find((party) => party.id === property.allottedTo);
            return (
              <article className="rounded-lg border border-border p-4" key={property.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-accent-foreground">
                    <Building2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Item {index + 1} · {propertyKindLabels[property.kind]} · {landUseLabels[property.landUse]}
                    </p>
                    <p className="mt-1 break-words font-semibold leading-6 text-primary">{[property.identifier, property.description].filter(Boolean).join(" — ")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[property.khasra ? "Khasra " + property.khasra : "", property.area ? areaTriple(property, "english") : ""].filter(Boolean).join(" · ")}
                    </p>
                    {property.locality || property.village || property.district ? (
                      <p className="mt-1 flex items-start gap-1 text-sm text-foreground/80">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        {[property.locality, property.village, property.tehsil, property.district, property.state].filter(Boolean).join(", ")}
                      </p>
                    ) : null}
                    {allotment ? (
                      <p className={"mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold " + (allottee ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                        {allottee ? "Allotted to " + displayName(allottee, "hindi") : "Not yet allotted"}
                      </p>
                    ) : null}
                  </div>
                  <RowActions disabled={editor.pending} label={"item " + (index + 1)} onDelete={() => editor.remove(property, "item " + (index + 1))} onEdit={() => editor.setEditing(property)} />
                </div>
                <div className="mt-4 grid grid-cols-3 grid-rows-3 gap-1 text-center text-[11px] leading-4 sm:text-xs">
                  <span />
                  <Boundary label="N" size={property.northSize} value={property.north} />
                  <span />
                  <Boundary label="W" size={property.westSize} value={property.west} />
                  <span className="grid place-items-center rounded-md bg-primary/90 p-2 font-semibold text-primary-foreground">{property.construction || property.builtUpArea ? "Built" : "Property"}</span>
                  <Boundary label="E" size={property.eastSize} value={property.east} />
                  <span />
                  <Boundary label="S" size={property.southSize} value={property.south} />
                  <span />
                </div>
                {property.marketValue ? <p className="mt-3 text-xs text-muted-foreground">DLC market value: <span className="font-semibold text-primary">{formatINR(property.marketValue)}</span></p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          action={<Button className="h-9" onClick={add} type="button"><Plus className="size-4" /> Add property</Button>}
          description="Add the plot, house, shop or land with its plot and khasra number, area, the four boundaries and their measurements."
          icon={Building2}
          title="No property added"
        />
      )}
      <Modal
        className="sm:max-w-3xl"
        footer={<SubmitFooter formId="property-form" label="Save property" onCancel={() => editor.setEditing(null)} pending={editor.pending} />}
        onClose={() => editor.setEditing(null)}
        open={editor.editing !== null}
        title={editor.editing === "new" ? "Add property" : "Edit property"}
      >
        {editor.editing !== null ? (
          <PropertyForm
            allottees={allotment ? allottees : []}
            initial={editor.editing === "new" ? undefined : editor.editing}
            key={editor.editing === "new" ? "new" : editor.editing.id}
            onSubmit={editor.upsert}
          />
        ) : null}
      </Modal>
    </section>
  );
}

function Boundary({ label, value, size }: { label: string; value?: string; size?: string }) {
  return (
    <span className="flex min-w-0 flex-col justify-center rounded-md border border-border bg-secondary/40 p-1.5">
      <strong className="text-primary">{label}{size ? <span className="font-normal text-muted-foreground"> · {size}</span> : null}</strong>
      <span className="line-clamp-2 break-words text-muted-foreground">{value || "—"}</span>
    </span>
  );
}

const sides = [
  ["east", "पूर्व / East", "e.g. आम रास्ता 20 फुट चौड़ा"],
  ["west", "पश्चिम / West", "e.g. अन्य की भूमि"],
  ["north", "उत्तर / North", "e.g. भूखण्ड संख्या 38"],
  ["south", "दक्षिण / South", "e.g. भूखण्ड संख्या 40"],
] as const;

function PropertyForm({ initial, allottees, onSubmit }: { initial?: Property; allottees: Party[]; onSubmit: (property: Property) => void }) {
  const form = useForm<z.input<typeof propertySchema>, unknown, Property>({
    resolver: zodResolver(propertySchema),
    defaultValues: initial ?? {
      id: crypto.randomUUID(),
      kind: "plot",
      landUse: "residential",
      description: "",
      identifier: "",
      khasra: "",
      area: "",
      areaUnit: "sq_yd",
      locality: "",
      village: "",
      tehsil: "",
      district: "",
      state: "राजस्थान",
      north: "",
      south: "",
      east: "",
      west: "",
      northSize: "",
      southSize: "",
      eastSize: "",
      westSize: "",
      construction: "",
      constructionType: "",
      builtUpArea: "",
      constructionYear: "",
      road: "",
      corner: false,
      marketValue: "",
      allottedTo: "",
    },
  });
  const errors = form.formState.errors;
  const area = Number(form.watch("area")) || 0;
  const unit = form.watch("areaUnit");
  const preview = area ? areaTriple({ area, areaUnit: unit } as Property, "english") : "";

  return (
    <form className="space-y-4" id="property-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FormGroup title="Identification">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type">
            <select className={inputClass} {...form.register("kind")}>
              {Object.entries(propertyKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Use">
            <select className={inputClass} {...form.register("landUse")}>
              {Object.entries(landUseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        </div>
        <Field hint="plot / house / shop / AMC no." label="Number">
          <input className={inputClass} placeholder="e.g. 39 or 04 व 5-ए का भाग" {...form.register("identifier")} />
        </Field>
        <Field hint="साबिक / हाल" label="Khasra number">
          <input className={inputClass} placeholder="e.g. 569 or 1335 (साबिक) = 952 (हाल)" {...form.register("khasra")} />
        </Field>
        <Field hint="राजस्व ग्राम" label="Revenue village">
          <input className={inputClass} placeholder="e.g. बडगांव" {...form.register("village")} />
        </Field>
        <Field className="sm:col-span-2" error={errors.description?.message} label="Short description">
          <textarea className={textareaClass + " min-h-16"} placeholder="e.g. आवासीय भूखण्ड (दक्षिणी भाग)" {...form.register("description")} />
        </Field>
      </FormGroup>

      <FormGroup title="Location & area">
        <Field className="sm:col-span-2" hint="colony / scheme / mohalla" label="Locality">
          <input className={inputClass} placeholder="e.g. पृथ्वीराज नगर योजना, अजमेर विकास प्राधिकरण" {...form.register("locality")} />
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
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
          <Field error={errors.area?.message} label="Area">
            <input className={inputClass} inputMode="decimal" {...form.register("area")} />
          </Field>
          <Field label="Unit">
            <select className={inputClass} {...form.register("areaUnit")}>
              {Object.entries(areaUnitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        </div>
        {preview ? <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-secondary-foreground sm:col-span-2">{preview}</p> : null}
        <Field error={errors.marketValue?.message} hint="₹, optional" label="DLC market value">
          <input className={inputClass} inputMode="decimal" {...form.register("marketValue")} />
        </Field>
        <Field hint="optional" label="Road">
          <input className={inputClass} placeholder="e.g. कॉलोनी की उप सड़क" {...form.register("road")} />
        </Field>
        <div className="sm:col-span-2">
          <CheckboxField label="Corner property" {...form.register("corner")} />
        </div>
      </FormGroup>

      <FormGroup description="चौहद्दी व नाप" title="Boundaries & measurements">
        {sides.map(([side, label, placeholder]) => (
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2" key={side}>
            <Field label={label}>
              <input className={inputClass} placeholder={placeholder} {...form.register(side)} />
            </Field>
            <Field label="Length">
              <input className={inputClass} placeholder={"21'0\""} {...form.register((side + "Size") as "eastSize")} />
            </Field>
          </div>
        ))}
      </FormGroup>

      <FormGroup description="leave empty for open land" title="Construction">
        <Field className="sm:col-span-2" hint="rooms on each floor" label="Construction details">
          <textarea className={textareaClass + " min-h-16"} placeholder="e.g. ग्राउण्ड फ्लोर पर दो कमरे, एक हॉल, एक रसोईघर; प्रथम तल पर एक कमरा" {...form.register("construction")} />
        </Field>
        <Field label="Construction type">
          <input className={inputClass} placeholder="e.g. आर.सी.सी." {...form.register("constructionType")} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field hint="sq. ft." label="Built-up area">
            <input className={inputClass} inputMode="decimal" {...form.register("builtUpArea")} />
          </Field>
          <Field label="Year built">
            <input className={inputClass} inputMode="numeric" {...form.register("constructionYear")} />
          </Field>
        </div>
      </FormGroup>

      {allottees.length ? (
        <FormGroup title="Allotment">
          <Field className="sm:col-span-2" label="Allotted / bequeathed to">
            <select className={inputClass} {...form.register("allottedTo")}>
              <option value="">Not allotted</option>
              {allottees.map((party) => <option key={party.id} value={party.id}>{displayName(party, "hindi")}</option>)}
            </select>
          </Field>
        </FormGroup>
      ) : null}
    </form>
  );
}
