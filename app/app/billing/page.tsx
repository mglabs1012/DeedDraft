import { Check, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <div className="max-w-3xl"><p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Plan & billing</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Your DeedDraft plan</h1><section className="mt-7 rounded-xl border border-border bg-card p-6 shadow-sm"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><span className="grid size-11 place-items-center rounded-xl bg-secondary text-accent-foreground"><CreditCard className="size-5" /></span><h2 className="mt-5 text-xl font-semibold text-primary">Free plan</h2><p className="mt-1 text-sm text-muted-foreground">For trying the deed workspace with a single firm.</p></div><Button disabled>Upgrade · Coming soon</Button></div><ul className="mt-7 grid gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:grid-cols-2"><li className="flex gap-2"><Check className="size-4 text-emerald-700" />10 deeds per month</li><li className="flex gap-2"><Check className="size-4 text-emerald-700" />Private document repository</li><li className="flex gap-2"><Check className="size-4 text-emerald-700" />Firm workspace</li><li className="flex gap-2"><Check className="size-4 text-emerald-700" />More plans in the next phase</li></ul></section></div>
  );
}
