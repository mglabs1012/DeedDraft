"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateProfile } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { updateProfileSchema } from "@/lib/schemas/deed-data";

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName, phone },
  });

  const submit = form.handleSubmit((values) => {
    startTransition(() => void updateProfile(values).then((result) => {
      if (result?.error) return toast.error(result.error);
      toast.success("Profile saved.");
      form.reset(values);
    }));
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={form.formState.errors.fullName?.message} label="Full name">
          <input autoComplete="name" className={inputClass} {...form.register("fullName")} />
        </Field>
        <Field error={form.formState.errors.phone?.message} hint="optional" label="Phone">
          <input autoComplete="tel" className={inputClass} type="tel" {...form.register("phone")} />
        </Field>
      </div>
      <Field label="Email">
        <input className={inputClass} disabled value={email} />
      </Field>
      <Button className="h-10" disabled={pending || !form.formState.isDirty} type="submit">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile
      </Button>
    </form>
  );
}
