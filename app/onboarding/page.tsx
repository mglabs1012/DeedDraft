import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import { OnboardingForm } from "@/components/auth/forms";
import { getCurrentWorkspace, getCurrentUser } from "@/lib/workspace";

export default async function OnboardingPage() {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await getCurrentWorkspace();
  if (workspace) redirect("/app/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </span>
        <p className="mt-7 text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Set up your firm</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">Create your first workspace</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your workspace keeps matters and uploaded documents separated from every other firm.
        </p>
        <div className="mt-8"><OnboardingForm /></div>
      </section>
    </main>
  );
}
