"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <section className="max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive"><TriangleAlert className="size-6" /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-primary">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{error.message || "An unexpected error occurred while loading this page."}</p>
        <Button className="mt-6 h-10" onClick={reset}><RotateCcw className="size-4" /> Try again</Button>
      </section>
    </div>
  );
}
