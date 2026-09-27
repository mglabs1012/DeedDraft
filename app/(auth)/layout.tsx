import Link from "next/link";
import type { ReactNode } from "react";
import { Scale } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link className="flex items-center gap-3 text-lg font-semibold" href="/">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Scale className="size-5" />
          </span>
          DeedDraft
        </Link>
        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-[0.18em] text-accent uppercase">
            Built for advocates
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Calm, organised deed work—from first papers to approved draft.
          </h1>
          <p className="mt-5 leading-7 text-primary-foreground/75">
            Keep every property document, instruction, and drafting decision in one secure firm workspace.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">Designed for Indian legal practice.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link className="mb-8 flex items-center gap-2.5 font-semibold text-primary lg:hidden" href="/">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Scale className="size-4" />
            </span>
            DeedDraft
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
