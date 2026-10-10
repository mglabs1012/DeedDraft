import { UpdatePasswordForm } from "@/components/auth/forms";

export default function UpdatePasswordPage() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Secure account</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Choose a new password</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Use at least eight characters and keep it unique to DeedDraft.
      </p>
      <div className="mt-8"><UpdatePasswordForm /></div>
    </div>
  );
}
