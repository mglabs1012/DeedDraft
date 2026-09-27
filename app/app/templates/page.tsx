import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { DeedIcon } from "@/components/deeds/deed-icon";
import { deedTypeOrder, deedTypes } from "@/lib/deed-types";

export const metadata = { title: "Templates" };

const languageNames = { hindi: "हिंदी", english: "English" } as const;

export default function TemplatesPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Template library</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Deed templates</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Modelled on registered deeds drafted in Rajasthan. Each template turns the parties, property schedule, chain of title and payments you record in a matter into a draft in Hindi, English or both.
      </p>
      <div className="mt-6 grid gap-4 sm:mt-7 md:grid-cols-2 xl:grid-cols-3">
        {deedTypeOrder.filter((type) => type !== "other").map((type) => {
          const config = deedTypes[type];
          return (
            <article className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm" key={type}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-accent-foreground"><DeedIcon className="size-5" type={type} /></span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-primary">{config.label}</h2>
                  <p className="font-devanagari text-sm text-foreground/80">{config.heading.hindi}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{config.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground">
                  {config.roles.first.en.split(" (")[0]} → {config.roles.second.en.split(" (")[0]}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 font-devanagari font-semibold text-secondary-foreground">
                  {config.roles.first.hi.m} → {config.roles.second.hi.m}
                </span>
                {config.languages.map((language) => (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700" key={language}>{languageNames[language]}</span>
                ))}
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-foreground/80">
                {config.highlights.map((item) => <li className="flex gap-2" key={item}><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}
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
