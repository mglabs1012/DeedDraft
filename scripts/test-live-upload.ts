/** Synthetic transport smoke test. Does not read deeds or invoke AI.
 * Uses the existing server administrator credential ONLY to sign isolated test
 * paths and remove its own fixtures. Does not test end-user RLS.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { Upload, DetailedError } from "tus-js-client";
import { signedUploadEndpoint } from "../lib/uploads/mime";

loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !adminKey || !publicKey) throw new Error("Missing test configuration.");
  const client = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = client.storage.from("deed-documents");
  const folder = randomUUID() + "/" + randomUUID();
  const paths: string[] = [];
  try {
    for (const size of [1024, 6 * 1024 * 1024 + 1024]) {
      const path = folder + "/" + randomUUID() + "-transport-test.pdf";
      paths.push(path);
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error || !data) throw new Error("Could not sign synthetic test path.");
      const bytes = Buffer.alloc(size, 32);
      bytes.write("%PDF-1.4\n% Synthetic transport fixture; no client data.\n");
      await new Promise<void>((resolve, reject) => {
        new Upload(bytes, {
          endpoint: signedUploadEndpoint(url),
          headers: { "x-signature": data.token, apikey: publicKey },
          metadata: { bucketName: "deed-documents", objectName: path, contentType: "application/pdf", cacheControl: "3600" },
          chunkSize: 6 * 1024 * 1024, uploadDataDuringCreation: true,
          retryDelays: [0, 1000, 3000], storeFingerprintForResuming: false,
          onError(error) {
            // Never print DetailedError: it includes signed URLs and credentials.
            const response = error instanceof DetailedError ? error.originalResponse : undefined;
            reject(new Error("Synthetic transfer failed: HTTP " + (response?.getStatus() ?? "network")));
          },
          onSuccess: () => resolve(),
        }).start();
      });
      const { data: stored, error: infoError } = await bucket.info(path);
      if (infoError || stored?.size !== size) throw new Error("Stored size verification failed.");
      console.log("PASS signed TUS transfer and stored byte count: " + size + " bytes");
    }
  } finally {
    const { error } = await bucket.remove(paths);
    if (error) throw new Error("Test fixture cleanup failed; inspect isolated transport-test objects.");
    console.log("Synthetic test objects removed; no client documents changed.");
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Transport check failed."); process.exitCode = 1; });
