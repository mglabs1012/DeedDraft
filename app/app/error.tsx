"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Server errors arrive without their message in production; show a plain explanation and the log reference.
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <section className="max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive"><TriangleAlert className="size-6" /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-primary">{offline ? "You are offline" : "Something went wrong"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {offline ? "Check your internet connection, then try again. Nothing you saved has been lost." : "This page could not load. Your saved work is safe — please try again."}
        </p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p> : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button className="h-10" onClick={reset}><RotateCcw className="size-4" /> Try again</Button>
          <Link className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-primary hover:bg-secondary" href="/app/dashboard">Go to dashboard</Link>
        </div>
      </section>
    </div>
  );
}
