import { NewDeedForm } from "@/components/deeds/new-deed-form";
import { isDeedType } from "@/lib/deed-types";

export const metadata = { title: "New deed" };

export default async function NewDeedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const initialType = isDeedType(params.type) ? params.type : undefined;

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">New matter</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Start a new deed</h1>
      <p className="mt-2 text-sm text-muted-foreground">Set up the matter first. Parties, property details, and documents follow inside it.</p>
      <section className="mt-7 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7"><NewDeedForm initialType={initialType} /></section>
    </div>
  );
}
