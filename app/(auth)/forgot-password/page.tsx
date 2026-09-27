import { ForgotPasswordForm } from "@/components/auth/forms";

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Password help</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">Reset your password</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        We will send a secure password-reset link to your work email.
      </p>
      <div className="mt-8"><ForgotPasswordForm /></div>
    </div>
  );
}
