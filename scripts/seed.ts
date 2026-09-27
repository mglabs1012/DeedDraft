import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database";

function readEnvironment() {
  const raw = readFileSync(".env.local", "utf8");
  const get = (key: string) => raw.match(new RegExp("^" + key + "=(.*)$", "m"))?.[1]?.trim() ?? "";
  return {
    url: get("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

const { url, serviceRoleKey } = readEnvironment();
if (!url || !serviceRoleKey) throw new Error("Add Supabase values to .env.local before seeding.");

const supabase = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = "demo-advocate@deeddraft.example";
const password = "DemoOnly!2026";
const firmName = "Demo Rajasthan Legal Chambers";

async function seed() {
  const { data: userList, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  let user = userList.users.find((candidate) => candidate.email === email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Could not create demo user.");
    user = data.user;
  }

  await supabase.from("profiles").upsert({ id: user.id, full_name: "Demo Advocate", phone: "0000000000" });
  const { data: existingFirm } = await supabase.from("firms").select("id").eq("name", firmName).maybeSingle();
  let firmId = existingFirm?.id;
  if (!firmId) {
    const { data, error } = await supabase.from("firms").insert({ name: firmName, city: "Jaipur", state: "Rajasthan" }).select("id").single();
    if (error || !data) throw error ?? new Error("Could not create demo firm.");
    firmId = data.id;
  }

  await supabase.from("firm_members").upsert({ firm_id: firmId, user_id: user.id, role: "owner" }, { onConflict: "firm_id,user_id" });
  const { count } = await supabase.from("deeds").select("id", { count: "exact", head: true }).eq("firm_id", firmId);
  if ((count ?? 0) === 0) {
    const deeds = [
      ["sale", "Sale Deed – Demo Plot 12, Vaishali Nagar", "draft"],
      ["release", "Release Deed – Demo Family Property", "data_collection"],
      ["gift", "Gift Deed – Demo Residential House", "under_review"],
      ["partition", "Partition Deed – Demo Ancestral Land", "draft"],
      ["will", "Will – Demo Testator", "generated"],
      ["sale", "Sale Deed – Demo Shop, C-Scheme", "finalized"],
    ] as const;
    const { data, error } = await supabase.from("deeds").insert(
      deeds.map(([deed_type, title, status]) => ({
        firm_id: firmId,
        deed_type,
        title,
        language: "english" as const,
        status,
        remarks: "FAKE DEMO DATA — do not use for a real legal matter.",
        created_by: user!.id,
      })),
    ).select("id, reference_no");
    if (error) throw error;
    if (data?.length) {
      await supabase.from("activity_log").insert(data.map((deed) => ({
        firm_id: firmId!,
        deed_id: deed.id,
        user_id: user!.id,
        action: "seeded_demo_deed",
        details: { reference_no: deed.reference_no, fake_data: true },
      })));
    }
  }
  console.log("Demo workspace ready. Email: " + email + " Password: " + password);
}

void seed();
