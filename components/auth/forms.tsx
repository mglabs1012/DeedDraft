"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import {
  completeOnboarding,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/schemas/auth";
import { onboardingSchema, type OnboardingInput } from "@/lib/schemas";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15";

function FormMessage({ message }: { message?: string }) {
  return message ? (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>
  ) : null;
}

function PendingIcon({ pending }: { pending: boolean }) {
  return pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />;
}

export function SignInForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = form.handleSubmit((values) => {
    setMessage(undefined);
    startTransition(() => {
      void signIn(values).then((result) => {
        if (result.error) return setMessage(result.error);
        toast.success("Welcome back.");
        router.replace("/app/dashboard");
        router.refresh();
      });
    });
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormMessage message={message} />
      <label className="block space-y-2 text-sm font-medium">
        Email address
        <input className={inputClass} type="email" autoComplete="email" {...form.register("email")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.email?.message}</span>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Password
        <input className={inputClass} type="password" autoComplete="current-password" {...form.register("password")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.password?.message}</span>
      </label>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Secure firm workspace</span>
        <Link className="font-medium text-primary hover:underline" href="/forgot-password">
          Forgot password?
        </Link>
      </div>
      <Button className="h-11 w-full" disabled={pending} type="submit">
        <PendingIcon pending={pending} /> Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to DeedDraft?{" "}
        <Link className="font-medium text-primary hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const submit = form.handleSubmit((values) => {
    setMessage(undefined);
    startTransition(() => {
      void signUp(values).then((result) => {
        if (result.error) return setMessage(result.error);
        toast.success(result.message ?? "Account created.");
        router.replace("/login");
      });
    });
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormMessage message={message} />
      <label className="block space-y-2 text-sm font-medium">
        Work email
        <input className={inputClass} type="email" autoComplete="email" {...form.register("email")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.email?.message}</span>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Password
        <input className={inputClass} type="password" autoComplete="new-password" {...form.register("password")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.password?.message}</span>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Confirm password
        <input className={inputClass} type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.confirmPassword?.message}</span>
      </label>
      <Button className="h-11 w-full" disabled={pending} type="submit">
        <PendingIcon pending={pending} /> Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const submit = form.handleSubmit((values) => {
    setMessage(undefined);
    startTransition(() => {
      void requestPasswordReset(values).then((result) => {
        if (result.error) return setMessage(result.error);
        toast.success(result.message ?? "Check your email.");
        form.reset();
      });
    });
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormMessage message={message} />
      <label className="block space-y-2 text-sm font-medium">
        Email address
        <input className={inputClass} type="email" autoComplete="email" {...form.register("email")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.email?.message}</span>
      </label>
      <Button className="h-11 w-full" disabled={pending} type="submit">
        <PendingIcon pending={pending} /> Send reset link
      </Button>
      <Link className="block text-center text-sm font-medium text-primary hover:underline" href="/login">
        Back to sign in
      </Link>
    </form>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const form = useForm({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const submit = form.handleSubmit((values) => {
    setMessage(undefined);
    startTransition(() => {
      void updatePassword(values).then((result) => {
        if (result.error) return setMessage(result.error);
        toast.success(result.message ?? "Password updated.");
        router.replace("/app/dashboard");
      });
    });
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormMessage message={message} />
      <label className="block space-y-2 text-sm font-medium">
        New password
        <input className={inputClass} type="password" autoComplete="new-password" {...form.register("password")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.password?.message}</span>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Confirm new password
        <input className={inputClass} type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.confirmPassword?.message}</span>
      </label>
      <Button className="h-11 w-full" disabled={pending} type="submit">
        <PendingIcon pending={pending} /> Update password
      </Button>
    </form>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { fullName: "", phone: "", firmName: "", city: "" },
  });

  const submit = form.handleSubmit((values) => {
    setMessage(undefined);
    startTransition(() => {
      void completeOnboarding(values).then((result) => {
        if (result.error) return setMessage(result.error);
        toast.success(result.message ?? "Workspace created.");
        router.replace("/app/dashboard");
        router.refresh();
      });
    });
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <FormMessage message={message} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Your full name
          <input className={inputClass} autoComplete="name" {...form.register("fullName")} />
          <span className="text-xs font-normal text-destructive">{form.formState.errors.fullName?.message}</span>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
          <input className={inputClass} type="tel" autoComplete="tel" {...form.register("phone")} />
          <span className="text-xs font-normal text-destructive">{form.formState.errors.phone?.message}</span>
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        Firm name
        <input className={inputClass} {...form.register("firmName")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.firmName?.message}</span>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        City
        <input className={inputClass} placeholder="e.g. Jaipur" {...form.register("city")} />
        <span className="text-xs font-normal text-destructive">{form.formState.errors.city?.message}</span>
      </label>
      <Button className="h-11 w-full" disabled={pending} type="submit">
        <Building2 className="size-4" /> Create workspace
      </Button>
    </form>
  );
}
