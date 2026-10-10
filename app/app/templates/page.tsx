import { ClipboardPen, FileDown, ListChecks } from "lucide-react";

import { TemplateLibrary } from "@/components/templates/template-library";
import { libraryIndex } from "@/lib/templates/library.server";

export const metadata = { title: "Templates" };

const steps = [
  { icon: ListChecks, title: "Choose a document", text: "Pick from the most used deeds or search all templates." },
  { icon: ClipboardPen, title: "Answer simple questions", text: "Names, address, amount, dates — in plain words." },
  { icon: FileDown, title: "Download your draft", text: "Get it in Hindi or English as Word or PDF." },
];

export default function TemplatesPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Template library</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Find the right document</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        {libraryIndex.length + 8} ready templates. You don&apos;t need legal knowledge: answer a few questions and DeedDraft prepares the draft for you.
      </p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li className="flex gap-3 rounded-xl border border-border bg-card p-4" key={step.title}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-primary">{index + 1}</span>
            <span>
              <span className="flex items-center gap-1.5 font-semibold text-primary"><step.icon className="size-4 text-accent-foreground" /> {step.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-8"><TemplateLibrary library={libraryIndex} /></div>
    </div>
  );
}
