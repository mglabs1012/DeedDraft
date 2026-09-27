"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateFirm } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { updateFirmSchema } from "@/lib/schemas/settings";
import type { Firm } from "@/types/database";

const inputClass = "mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export function FirmSettingsForm({ firm, canEdit }: { firm: Firm; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(updateFirmSchema),
    defaultValues: { name: firm.name, city: firm.city, barRegistrationNo: firm.bar_registration_no ?? "" },
  });

  const submit = form.handleSubmit((values) => {
    startTransition(() => void updateFirm(values).then((result) => {
      if (result?.error) toast.error(result.error); else toast.success("Firm settings saved.");
    }));
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-primary">Firm name<input className={inputClass} disabled={!canEdit} {...form.register("name")} /><span className="text-xs font-normal text-destructive">{form.formState.errors.name?.message}</span></label>
        <label className="text-sm font-medium text-primary">City<input className={inputClass} disabled={!canEdit} {...form.register("city")} /><span className="text-xs font-normal text-destructive">{form.formState.errors.city?.message}</span></label>
      </div>
      <label className="block text-sm font-medium text-primary">Bar registration number <span className="font-normal text-muted-foreground">(optional)</span><input className={inputClass} disabled={!canEdit} {...form.register("barRegistrationNo")} /></label>
      {canEdit ? <Button disabled={pending} type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes</Button> : <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">Only the firm owner can edit these settings.</p>}
    </form>
  );
}
