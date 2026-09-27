"use server";

import { revalidatePath } from "next/cache";

import {
  createDeedSchema,
  deedIdSchema,
  deleteDeedSchema,
  updateDeedStatusSchema,
  updateDeedTitleSchema,
  updateRemarksSchema,
} from "@/lib/schemas/deeds";
import { parseDeedData, updateDeedSectionSchema } from "@/lib/schemas/deed-data";
import { requireWorkspace } from "@/lib/workspace";
import type { Json } from "@/types/database";

type ActionResult = { error?: string; id?: string };

async function findDeed(id: string) {
  const workspace = await requireWorkspace();
  const { data, error } = await workspace.supabase
    .from("deeds")
    .select("*")
    .eq("id", id)
    .eq("firm_id", workspace.firm.id)
    .maybeSingle();

  if (error || !data) return { workspace, deed: null };
  return { workspace, deed: data };
}

export async function createDeed(input: unknown): Promise<ActionResult> {
  const parsed = createDeedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const workspace = await requireWorkspace();
  const { data, error } = await workspace.supabase
    .from("deeds")
    .insert({
      firm_id: workspace.firm.id,
      deed_type: parsed.data.deedType,
      title: parsed.data.title,
      language: parsed.data.language,
      remarks: parsed.data.remarks || null,
      created_by: workspace.user.id,
    })
    .select("id, reference_no")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create the deed." };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: data.id,
    user_id: workspace.user.id,
    action: "created_deed",
    details: { reference_no: data.reference_no, deed_type: parsed.data.deedType },
  });

  revalidatePath("/app/dashboard");
  revalidatePath("/app/deeds");
  return { id: data.id };
}

export async function updateDeedTitle(input: unknown): Promise<ActionResult> {
  const parsed = updateDeedTitleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { workspace, deed } = await findDeed(parsed.data.id);
  if (!deed) return { error: "Deed not found." };

  const { error } = await workspace.supabase
    .from("deeds")
    .update({ title: parsed.data.title })
    .eq("id", deed.id);

  if (error) return { error: error.message };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: deed.id,
    user_id: workspace.user.id,
    action: "updated_title",
    details: { title: parsed.data.title },
  });

  revalidatePath("/app/deeds/" + deed.id);
  revalidatePath("/app/deeds");
  return {};
}

export async function updateDeedStatus(input: unknown): Promise<ActionResult> {
  const parsed = updateDeedStatusSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { workspace, deed } = await findDeed(parsed.data.id);
  if (!deed) return { error: "Deed not found." };

  const { error } = await workspace.supabase
    .from("deeds")
    .update({ status: parsed.data.status })
    .eq("id", deed.id);

  if (error) return { error: error.message };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: deed.id,
    user_id: workspace.user.id,
    action: "changed_status",
    details: { status: parsed.data.status },
  });

  revalidatePath("/app/deeds/" + deed.id);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/deeds");
  return {};
}

export async function updateRemarks(input: unknown): Promise<ActionResult> {
  const parsed = updateRemarksSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { workspace, deed } = await findDeed(parsed.data.id);
  if (!deed) return { error: "Deed not found." };

  const { error } = await workspace.supabase
    .from("deeds")
    .update({ remarks: parsed.data.remarks || null })
    .eq("id", deed.id);

  if (error) return { error: error.message };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: deed.id,
    user_id: workspace.user.id,
    action: "updated_remarks",
    details: {},
  });

  revalidatePath("/app/deeds/" + deed.id);
  return {};
}

export async function duplicateDeed(input: unknown): Promise<ActionResult> {
  const parsed = deedIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid deed." };

  const { workspace, deed } = await findDeed(parsed.data.id);
  if (!deed) return { error: "Deed not found." };

  const { data, error } = await workspace.supabase
    .from("deeds")
    .insert({
      firm_id: workspace.firm.id,
      deed_type: deed.deed_type,
      title: "Copy of " + deed.title,
      language: deed.language,
      data: deed.data,
      remarks: deed.remarks,
      created_by: workspace.user.id,
    })
    .select("id, reference_no")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not duplicate the deed." };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: data.id,
    user_id: workspace.user.id,
    action: "duplicated_deed",
    details: { source_deed_id: deed.id, reference_no: data.reference_no },
  });

  revalidatePath("/app/deeds");
  revalidatePath("/app/dashboard");
  return { id: data.id };
}

export async function deleteDeed(input: unknown): Promise<ActionResult> {
  const parsed = deleteDeedSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter the exact reference number to delete this deed." };

  const { workspace, deed } = await findDeed(parsed.data.id);
  if (!deed || deed.reference_no !== parsed.data.referenceNo) {
    return { error: "The reference number does not match." };
  }

  const { data: documents } = await workspace.supabase
    .from("deed_documents")
    .select("storage_path")
    .eq("deed_id", deed.id);

  if (documents?.length) {
    const { error: storageError } = await workspace.supabase.storage
      .from("deed-documents")
      .remove(documents.map((document) => document.storage_path));
    if (storageError) return { error: storageError.message };
  }

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: deed.id,
    user_id: workspace.user.id,
    action: "deleted_deed",
    details: { reference_no: deed.reference_no, title: deed.title },
  });

  const { error } = await workspace.supabase.from("deeds").delete().eq("id", deed.id);
  if (error) return { error: error.message };

  revalidatePath("/app/deeds");
  revalidatePath("/app/dashboard");
  return {};
}

export async function updateDeedSection(input: unknown): Promise<ActionResult> {
  const parsed = updateDeedSectionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details." };

  const { workspace, deed } = await findDeed(parsed.data.id);
  if (!deed) return { error: "Deed not found." };

  const data = { ...parseDeedData(deed.data), [parsed.data.section]: parsed.data.value };
  const { error } = await workspace.supabase
    .from("deeds")
    .update({ data: data as unknown as Json })
    .eq("id", deed.id);

  if (error) return { error: error.message };

  await workspace.supabase.from("activity_log").insert({
    firm_id: workspace.firm.id,
    deed_id: deed.id,
    user_id: workspace.user.id,
    action: "updated_" + parsed.data.section,
    details: {},
  });

  revalidatePath("/app/deeds/" + deed.id);
  revalidatePath("/app/deeds");
  return {};
}
