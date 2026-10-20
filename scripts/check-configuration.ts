import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ai = ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].every((name) => Boolean(process.env[name]?.trim()));
  console.log("AI credentials configured: " + (ai ? "yes (not a live model test)" : "no"));
  if (!url || !key || url.includes("YOUR_PROJECT")) {
    console.log("Supabase: missing project URL or publishable key.");
    process.exitCode = 1;
    return;
  }
  const headers = { apikey: key, Authorization: "Bearer " + key };
  const checks: Array<[string, string]> = [
    ["Authentication", "/auth/v1/settings"],
    ["Deed storage schema", "/rest/v1/deeds?select=id,data,updated_at&limit=0"],
    ["Document OCR schema (migration 0004)", "/rest/v1/deed_documents?select=id,extracted_text,text_quality,processed_at&limit=0"],
    ["Draft versions (migration 0004)", "/rest/v1/deed_drafts?select=id,content,version&limit=0"],
    ["AI memory (migration 0005)", "/rest/v1/ai_memory?select=id&limit=0"],
  ];
  for (const [label, path] of checks) {
    try {
      const response = await fetch(url + path, { headers, signal: AbortSignal.timeout(15000) });
      console.log(label + ": " + (response.ok ? "reachable" : "needs attention (HTTP " + response.status + ")"));
      if (!response.ok) process.exitCode = 1;
    } catch {
      console.log(label + ": connection failed");
      process.exitCode = 1;
    }
  }
  console.log("Read-only check. No client records were retrieved. Signed-in storage access and AI inference require an in-app test.");
}
main().catch(() => { console.error("Configuration check failed."); process.exitCode = 1; });
