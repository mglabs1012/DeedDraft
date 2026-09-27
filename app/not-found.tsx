import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6">
      <section className="max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary text-accent-foreground"><FileQuestion className="size-6" /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-primary">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">This deed or page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Link className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/app/dashboard">Back to dashboard</Link>
      </section>
    </main>
  );
}
