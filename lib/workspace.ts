import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Firm, FirmMember } from "@/types/database";

/** Cached per request: the layout, page and actions share one auth check. */
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
});

export async function requireUser() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

/**
 * Cached per request: user, membership and firm are read once however many
 * components ask. Membership and firm come back in one query (the firm is
 * embedded through the firm_id foreign key), so every page and action makes
 * one database round trip here instead of two.
 */
export const getCurrentWorkspace = cache(async function getCurrentWorkspace() {
  const { supabase, user } = await requireUser();
  const joined = await supabase
    .from("firm_members")
    .select("*, firm:firms(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!joined.error) {
    const row = (joined.data as unknown as Array<FirmMember & { firm: Firm | null }> | null)?.[0];
    if (!row) return null;
    const { firm, ...membership } = row;
    if (firm) return { supabase, user, membership: membership as FirmMember, firm };
  }

  // The embedded read is unavailable (for example a stale API schema cache): read the two rows one after the other.
  const { data: memberships, error: membershipError } = await supabase
    .from("firm_members")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  if (membershipError) throw new Error(membershipError.message);

  const membership = memberships?.[0] as FirmMember | undefined;
  if (!membership) return null;

  const { data: firm, error: firmError } = await supabase.from("firms").select("*").eq("id", membership.firm_id).single();
  if (firmError) throw new Error(firmError.message);

  return { supabase, user, membership, firm: firm as Firm };
});

export async function requireWorkspace() {
  const workspace = await getCurrentWorkspace();

  if (!workspace) {
    redirect("/onboarding");
  }

  return workspace;
}
