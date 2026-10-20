import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { uploadMimes } from "../lib/uploads/mime";

loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.includes("YOUR_KEY")) { console.log("Server-side storage administrator key is not configured. Run migration 0007 in Supabase instead."); process.exitCode = 1; return; }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: bucket, error } = await client.storage.getBucket("deed-documents");
  if (error || !bucket) { console.log("Could not inspect the deed-documents bucket. Verify the server administrator key."); process.exitCode = 1; return; }
  console.log("Private bucket: " + !bucket.public);
  console.log("Upload size limit: " + bucket.file_size_limit);
  const missing = [...new Set(Object.values(uploadMimes))].filter((mime) => bucket.allowed_mime_types && !bucket.allowed_mime_types.includes(mime));
  console.log("Requested MIME types missing: " + missing.join(", "));
  if (!process.argv.includes("--apply") || !missing.length) return;
  if (bucket.public) throw new Error("Expected a private bucket. No changes applied.");
  const { error: updateError } = await client.storage.updateBucket("deed-documents", {
    public: false,
    fileSizeLimit: bucket.file_size_limit ?? 20 * 1024 * 1024,
    allowedMimeTypes: [...new Set([...(bucket.allowed_mime_types ?? []), ...Object.values(uploadMimes)])],
  });
  if (updateError) throw new Error("Storage configuration could not be updated.");
  console.log("Requested formats enabled. Private access, existing MIME types and size limit preserved.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Configuration failed."); process.exitCode = 1; });
