import Link from "next/link";
import type { ReactNode } from "react";
import { Scale } from "lucide-react";

import { SiteFooter } from "@/components/legal/site-footer";
import { site } from "@/lib/legal";

/** Public pages: policies, help and company information. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2.5 font-semibold text-primary" href="/login">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Scale className="size-4" />
            </span>
            {site.name}
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2 text-sm font-medium">
            <Link className="rounded-lg px-3 py-2 text-primary hover:bg-muted" href="/login">Sign in</Link>
            <Link className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/85" href="/signup">Create account</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
