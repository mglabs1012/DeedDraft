"use server";

import { z } from "zod";

import { normaliseTourPreferences } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

/** Remembers which guides the user has seen on their account, so they do not reappear on another device. */
export async function saveTourPreferences(input: unknown): Promise<{ error?: string }> {
  const parsed = z.object({ skipped: z.boolean(), completed: z.array(z.string().max(40)).max(20) }).safeParse(input);
  if (!parsed.success) return { error: "Invalid tour preferences." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { tour: normaliseTourPreferences(parsed.data) } });
  return error ? { error: "Tour preference was not saved." } : {};
}
