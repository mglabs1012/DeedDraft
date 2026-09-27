import { SignInForm } from "@/components/auth/forms";

export default function LoginPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Welcome back</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">Sign in to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Use your firm email to continue your deed work.
      </p>
      <div className="mt-8"><SignInForm /></div>
    </div>
  );
}
