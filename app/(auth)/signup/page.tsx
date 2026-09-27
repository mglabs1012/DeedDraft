import { SignUpForm } from "@/components/auth/forms";

export default function SignupPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Get started</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">Create your account</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Set up a secure workspace for your firm in a few minutes.
      </p>
      <div className="mt-8"><SignUpForm /></div>
    </div>
  );
}
