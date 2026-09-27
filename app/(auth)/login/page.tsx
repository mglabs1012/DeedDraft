import { Scale } from "lucide-react";

import { SignInForm } from "@/components/auth/forms";

export default function LoginPage() {
  return (
    <div>
      <div className="mb-8 lg:hidden">
        <div className="mb-5 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Scale className="size-5" />
        </div>
        <p className="font-semibold text-primary">DeedDraft</p>
      </div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Welcome back</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">Sign in to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Use your firm email to continue your deed work.
      </p>
      <div className="mt-8"><SignInForm /></div>
    </div>
  );
}
