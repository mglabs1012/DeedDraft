"use server";

import { revalidatePath } from "next/cache";

import { updateProfileSchema } from "@/lib/schemas/deed-data";
import { updateFirmSchema } from "@/lib/schemas/settings";
import { requireWorkspace } from "@/lib/workspace";

export async function updateFirm(input: unknown) {
  const parsed = updateFirmSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const workspace = await requireWorkspace();
  if (workspace.membership.role !== "owner") {
    return { error: "Only the firm owner can edit firm settings." };
  }

  const { error } = await workspace.supabase
    .from("firms")
    .update({
      name: parsed.data.name,
      city: parsed.data.city,
      bar_registration_no: parsed.data.barRegistrationNo || null,
    })
    .eq("id", workspace.firm.id);

  if (error) return { error: error.message };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    user_id: workspace.user.id,
    action: "updated_firm_settings",
    details: {},
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
  return {};
}

export async function updateProfile(input: unknown) {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const workspace = await requireWorkspace();
  const { error } = await workspace.supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", workspace.user.id);

  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return {};
}
