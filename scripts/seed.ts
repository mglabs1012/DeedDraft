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

// Entirely fictitious particulars — never use real names or ID numbers here.
const demoSaleData = {
  parties: [
    { id: "seller", role: "first", gender: "female", fullName: "डेमो विक्रेती देवी", relation: "W/o", relativeName: "डेमो पति", age: 40, caste: "डेमो", address: "मकान नम्बर 1, डेमो नगर, अजमेर (राज.)" },
    { id: "buyer", role: "second", gender: "male", fullName: "डेमो क्रेता कुमार", relation: "S/o", relativeName: "डेमो पिता", age: 35, caste: "डेमो", address: "मकान नम्बर 2, डेमो नगर, अजमेर (राज.)" },
    { id: "w1", role: "witness", gender: "male", fullName: "डेमो गवाह प्रथम", relation: "S/o", relativeName: "डेमो", age: 50, address: "अजमेर" },
    { id: "w2", role: "witness", gender: "male", fullName: "डेमो गवाह द्वितीय", relation: "S/o", relativeName: "डेमो", age: 45, address: "अजमेर" },
  ],
  properties: [
    { id: "plot", kind: "plot", landUse: "residential", description: "आवासीय भूखण्ड", identifier: "12", khasra: "000", village: "डेमो ग्राम", tehsil: "अजमेर", district: "अजमेर", state: "राजस्थान", area: 100, areaUnit: "sq_yd", east: "आम रास्ता 20 फुट चौड़ा", eastSize: "20'0\"", west: "अन्य की भूमि", westSize: "20'0\"", north: "भूखण्ड संख्या 11", northSize: "45'0\"", south: "भूखण्ड संख्या 13", southSize: "45'0\"" },
  ],
  titleChain: [{ id: "t1", instrument: "sale_deed", date: "2020-01-15", from: "डेमो पूर्व स्वामी", amount: 200000, office: "अजमेर (प्रथम)", book: "1", volume: "0000", page: "00", serial: "000000000000000" }],
  consideration: { total: 500000 },
  payments: [
    { id: "p1", mode: "cash", nature: "earnest", amount: 50000 },
    { id: "p2", mode: "rtgs_neft", nature: "payment", amount: 450000, reference: "DEMO0000000" },
  ],
  execution: { place: "अजमेर", expensesBy: "second", mapAttached: true },
};

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
      ["sale", "Sale Deed – Demo Plot 12, Vaishali Nagar", "data_collection"],
      ["agreement_to_sell", "Agreement to Sell – Demo House, Kiranipura", "draft"],
      ["gift", "Gift Deed – Demo Residential Plot", "under_review"],
      ["release", "Release Deed – Demo Family Property", "draft"],
      ["partition", "Partition Deed – Demo Ancestral Land", "draft"],
      ["will", "Will – Demo Testator", "generated"],
      ["lease", "Lease Deed – Demo Office, 2nd Floor", "draft"],
      ["rent", "Rent Deed – Demo Shop, Martindale Bridge", "finalized"],
    ] as const;
    const { data, error } = await supabase.from("deeds").insert(
      deeds.map(([deed_type, title, status]) => ({
        firm_id: firmId,
        deed_type,
        title,
        language: deed_type === "lease" ? ("english" as const) : ("hindi" as const),
        status,
        data: deed_type === "sale" ? demoSaleData : {},
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
