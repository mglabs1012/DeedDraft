import { SignInForm } from "@/components/auth/forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Welcome back</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Sign in to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Use your firm email to continue your deed work.
      </p>
      <div className="mt-8"><SignInForm next={typeof next === "string" ? next : undefined} /></div>
    </div>
  );
}
