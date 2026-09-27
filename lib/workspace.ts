import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Firm, FirmMember } from "@/types/database";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function getCurrentWorkspace() {
  const { supabase, user } = await requireUser();
  const { data: memberships, error: membershipError } = await supabase
    .from("firm_members")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membership = memberships?.[0] as FirmMember | undefined;
  if (!membership) {
    return null;
  }

  const { data: firm, error: firmError } = await supabase
    .from("firms")
    .select("*")
    .eq("id", membership.firm_id)
    .single();

  if (firmError) {
    throw new Error(firmError.message);
  }

  return {
    supabase,
    user,
    membership,
    firm: firm as Firm,
  };
}

export async function requireWorkspace() {
  const workspace = await getCurrentWorkspace();

  if (!workspace) {
    redirect("/onboarding");
  }

  return workspace;
}
