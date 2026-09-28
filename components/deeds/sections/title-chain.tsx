"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowDown, ArrowUp, Landmark, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatINR, instrumentLabels } from "@/lib/deeds";
import { shortDate } from "@/lib/drafting/hindi";
import { titleEntrySchema, type TitleEntry } from "@/lib/schemas/deed-data";

import { Empty, FormGroup, RowActions, SectionHeader, SubmitFooter, cardClass, useListEditor, type SaveSection } from "./shared";

const fromLabel: Partial<Record<TitleEntry["instrument"], [string, string]>> = {
  patta: ["Issued by", "e.g. अजमेर विकास प्राधिकरण, अजमेर"],
  allotment: ["Allotted by", "e.g. अजमेर विकास प्राधिकरण (लॉटरी पद्धति)"],
  rectification: ["Executed with", "e.g. पूर्ववर्ती विक्रेता श्रीमती राधा अग्रवाल"],
  agreement_to_sell: ["In favour of", "e.g. द्वितीयपक्ष क्रेता"],
  inheritance: ["Inherited from", "e.g. स्व. श्री मदन लाल (पिता)"],
};

export function TitleChainSection({ entries, save }: { entries: TitleEntry[]; save: SaveSection }) {
  const editor = useListEditor(entries, (next) => save("titleChain", next));

  return (
    <section className={cardClass}>
      <SectionHeader
        action={<Button className="h-9" onClick={() => editor.setEditing("new")} type="button"><Plus className="size-4" /> Add instrument</Button>}
        description="How the present owner acquired the property, oldest first. Each entry becomes a recital with its registration details."
        title="Chain of title"
      />
      {entries.length ? (
        <ol className="space-y-3 p-4 sm:p-5">
          {entries.map((entry, index) => (
            <li className="flex gap-3 rounded-lg border border-border p-3 sm:p-4" key={entry.id}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary">
                  {instrumentLabels[entry.instrument]}
                  {entry.date ? <span className="font-normal text-muted-foreground"> · {shortDate(entry.date)}</span> : null}
                </p>
                {entry.from ? <p className="break-words text-sm text-foreground/80">{entry.from}</p> : null}
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {entry.amount ? <span className="rounded bg-secondary px-2 py-0.5 font-semibold">{formatINR(entry.amount)}</span> : null}
                  {entry.office ? <span className="rounded bg-secondary px-2 py-0.5">SR {entry.office}</span> : null}
                  {entry.volume ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">Book {entry.book || "1"} · Vol {entry.volume}{entry.page ? " · Pg " + entry.page : ""}</span> : null}
                  {entry.serial ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">Sr {entry.serial}</span> : null}
                  {entry.addlVolume ? <span className="rounded bg-secondary px-2 py-0.5 font-mono">Addl Vol {entry.addlVolume}{entry.addlPages ? " · Pg " + entry.addlPages : ""}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
                <div className="flex">
                  <button aria-label="Move up" className="rounded-md p-2 text-muted-foreground hover:bg-secondary disabled:opacity-30" disabled={index === 0 || editor.pending} onClick={() => editor.move(entry, -1)} type="button"><ArrowUp className="size-4" /></button>
                  <button aria-label="Move down" className="rounded-md p-2 text-muted-foreground hover:bg-secondary disabled:opacity-30" disabled={index === entries.length - 1 || editor.pending} onClick={() => editor.move(entry, 1)} type="button"><ArrowDown className="size-4" /></button>
                </div>
                <RowActions disabled={editor.pending} label={"entry " + (index + 1)} onDelete={() => editor.remove(entry, "this instrument")} onEdit={() => editor.setEditing(entry)} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty
          action={<Button className="h-9" onClick={() => editor.setEditing("new")} type="button"><Plus className="size-4" /> Add instrument</Button>}
          description="Record the prior sale deed, patta or allotment with its Sub-Registrar book, volume (जिल्द), page and serial numbers."
          icon={Landmark}
          title="No title documents recorded"
        />
      )}
      <Modal
        className="sm:max-w-2xl"
        footer={<SubmitFooter formId="title-form" label="Save instrument" onCancel={() => editor.setEditing(null)} pending={editor.pending} />}
        onClose={() => editor.setEditing(null)}
        open={editor.editing !== null}
        title={editor.editing === "new" ? "Add title instrument" : "Edit title instrument"}
      >
        {editor.editing !== null ? (
          <TitleForm initial={editor.editing === "new" ? undefined : editor.editing} key={editor.editing === "new" ? "new" : editor.editing.id} onSubmit={editor.upsert} />
        ) : null}
      </Modal>
    </section>
  );
}

function TitleForm({ initial, onSubmit }: { initial?: TitleEntry; onSubmit: (entry: TitleEntry) => void }) {
  const form = useForm<z.input<typeof titleEntrySchema>, unknown, TitleEntry>({
    resolver: zodResolver(titleEntrySchema),
    defaultValues: initial ?? { id: crypto.randomUUID(), instrument: "sale_deed", date: "", from: "", amount: "", office: "", book: "1", volume: "", page: "", serial: "", addlVolume: "", addlPages: "", pastedOn: "", notes: "" },
  });
  const errors = form.formState.errors;
  const instrument = form.watch("instrument");
  const [label, placeholder] = fromLabel[instrument] ?? ["Acquired from", "e.g. सीमा कँवर पुत्री श्री नारायण सिंह, निवासी परबतपुरा, अजमेर"];

  return (
    <form className="space-y-4" id="title-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FormGroup title="Instrument">
        <Field label="Type">
          <select className={inputClass} {...form.register("instrument")}>
            {Object.entries(instrumentLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>
        <Field error={errors.date?.message} label="Date">
          <input className={inputClass} type="date" {...form.register("date")} />
        </Field>
        <Field className="sm:col-span-2" label={label}>
          <textarea className={textareaClass + " min-h-16"} placeholder={placeholder} {...form.register("from")} />
        </Field>
        {instrument === "sale_deed" || instrument === "release_deed" || instrument === "other" ? (
          <Field error={errors.amount?.message} hint="₹" label="Consideration">
            <input className={inputClass} inputMode="decimal" {...form.register("amount")} />
          </Field>
        ) : null}
      </FormGroup>
      {instrument !== "inheritance" ? (
        <FormGroup description="उप पंजीयक" title="Registration">
          <Field className="sm:col-span-2" label="Sub-Registrar office">
            <input className={inputClass} placeholder="e.g. अजमेर (द्वितीय)" {...form.register("office")} />
          </Field>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <Field label="Book">
              <input className={inputClass} {...form.register("book")} />
            </Field>
            <Field label="Volume" hint="जिल्द">
              <input className={inputClass} {...form.register("volume")} />
            </Field>
            <Field label="Page">
              <input className={inputClass} {...form.register("page")} />
            </Field>
          </div>
          <Field className="sm:col-span-2" hint="क्रम संख्या" label="Serial number">
            <input className={inputClass + " font-mono"} placeholder="e.g. 202103001103453" {...form.register("serial")} />
          </Field>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <Field label="Addl. volume">
              <input className={inputClass} {...form.register("addlVolume")} />
            </Field>
            <Field label="Addl. pages">
              <input className={inputClass} placeholder="24 से 34" {...form.register("addlPages")} />
            </Field>
            <Field error={errors.pastedOn?.message} hint="चस्पा" label="Pasted on">
              <input className={inputClass} type="date" {...form.register("pastedOn")} />
            </Field>
          </div>
        </FormGroup>
      ) : null}
      <Field hint="appended to the recital" label="Notes">
        <textarea className={textareaClass + " min-h-16"} {...form.register("notes")} />
      </Field>
    </form>
  );
}
