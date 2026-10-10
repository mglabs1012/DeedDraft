import { NewDeedForm } from "@/components/deeds/new-deed-form";
import { isAiConfigured } from "@/lib/ai/claude";
import { isDeedType } from "@/lib/deed-types";
import { getLibraryEntry, libraryIndex } from "@/lib/templates/library.server";

export const metadata = { title: "New document" };

export default async function NewDeedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; template?: string }>;
}) {
  const params = await searchParams;
  const initialTemplate = getLibraryEntry(params.template) ?? undefined;
  const initialType = !initialTemplate && isDeedType(params.type) ? params.type : undefined;

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">New document</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Start a new document</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose what you need. You&apos;ll fill in the details on the next screens.</p>
      <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:mt-7 sm:p-7">
        <NewDeedForm aiEnabled={isAiConfigured()} initialTemplate={initialTemplate} initialType={initialType} library={libraryIndex} />
      </section>
    </div>
  );
}
