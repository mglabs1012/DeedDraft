# Standard Mode

## What changed

- Home offers Standard Mode and a non-interactive Premium Mode placeholder.
- A template selection creates the deed immediately and opens its upload workspace.
- OCR / extraction fills parties, property, title history and transaction data. People from identity cards with an unclear role need the user's role assignment.
- Manual data is preserved when extraction finishes. Concurrent changes use an `updated_at` compare-and-swap rather than a blind JSON overwrite.
- Naksha and consideration panels are hidden by default. Their visibility is saved per deed. Hiding a panel does **not** delete facts or remove them from drafting.
- Instructions are saved and used to prepare an immutable draft version. The draft assistant proposes subsequent clause changes for review and application.
- Main screens no longer fetch activity feeds, dashboard counts or every saved draft. Secondary editors load on demand.

## Configuration / run

1. Keep the existing Supabase URL and public key in `.env.local`. Never put service-role or AWS secrets in a `NEXT_PUBLIC_` variable.
2. Apply migrations through `0008`. For a project that already has the initial schema, run the complete `supabase/standard-mode-update.sql` in Supabase SQL Editor. It includes missing OCR/draft/memory tables, accepted upload formats, and tighter document metadata permissions. The connectivity check on this machine found migrations `0004` and `0005` missing; AI credentials alone do not make drafting ready. No client records are deleted by this update.
3. For AI, configure `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and the existing Bedrock model settings. Use the in-app Settings connection test to confirm the account can invoke the configured model.
4. Run `npm install`, `npm test`, and `npm run typecheck`.
5. Run `npm run dev -- --webpack` for local development. On this Windows machine Turbopack's CSS worker failed; use `npm run build -- --webpack` then `npm start` for production validation.
6. Optional read-only connectivity check: `npx tsx scripts/check-configuration.ts`. It prints availability only, never credentials or client records.

An authenticated smoke test is still needed against the intended Supabase/Bedrock account: create a test deed, upload a non-sensitive paper, review extracted roles, correct a value, reload, toggle the optional panels, generate a draft and request a clause edit.

## Upload contract

- Supported: PDF; JPEG, PNG, WebP, GIF, TIFF, BMP, AVIF, HEIC/HEIF; ZIP/RAR; DOCX.
- 20 MB per upload / extracted document. Archives: maximum 30 files and 60 MB total expanded data.
- No encrypted, multi-volume, nested, path-traversing or link-containing archives. Unsupported archive entries are listed as skipped.
- ZIP inflation validates actual byte lengths. DOCX packages are also expanded through bounded validation before being retained for OCR.
- Archive members become individual private documents. The private source container is retained for processing retries and removed when the last document from that upload is deleted.
- JPEG/PNG/WebP are retained. Other image formats are converted for OCR/storage; all TIFF pages are retained in a PDF. Only the first GIF frame and main HEIC image are used, with a visible conversion notice.
- Files use the private `deed-documents` bucket, with **three-part** paths: `firm/deed/uploadUUID-source.ext` or `firm/deed/uploadUUID-index.ext`. Do not add an upload folder: the deployed Storage RLS rejects four-part paths. Authorization and finalization both check signed-in firm membership and deed ownership; no service-role bypass is used.
- Bytes travel directly to Supabase using signed, resumable TUS uploads (6 MB chunks), two simultaneous jobs, automatic transient retries, pause/resume, and an inactivity timeout. The progress bar reports actual transmitted bytes; processing is a separate stage.
- Small prepare/finalize requests use route handlers, avoiding Next's serial Server Action queue. Processing retries reuse deterministic document IDs and already transferred files. The host still needs Node processing/model requests up to 300 seconds.
- Keep the page open to retain the selected files and resume queue. Reloading loses that in-memory queue. If extraction fails, registered documents remain saved and extraction can be retried.
- Buyer, Seller and Witness each have a separate window with Identity Proofs, Property Documents, Prior/Old Deeds and Add Manually. Saved documents can be removed from the workspace, including the draft view.
- Drafting streams actual stage updates and offers Stop. Cancellation aborts in-flight model requests; a version whose save already committed may remain in draft history.

## October 20 authorization fix

The zero-byte authorization error was caused by a new four-segment upload path conflicting with the original three-segment storage policy. The uploader now uses the original supported layout, including converted/archive files. The fix does not require public access, disabling RLS, or signing in again. Reload the app and reselect the failed file after the update; no bytes from that failed authorization were saved.

Migration `0008` additionally qualifies deed/firm correlations in metadata policies and validates storage paths. It is prepared locally, not automatically applied to the remote database. Run the complete SQL bundle before testing OCR and saved drafts.

## Verification and limitations

`npm test` includes synthetic ZIP and RAR fixtures, archive traversal/size/encryption checks, image normalization and multi-page TIFF, hidden module persistence, multiple parties and non-destructive extraction.

AI availability shown in the UI indicates credential configuration, not a guarantee of model access or extraction accuracy. No claim of measured “80% automation” is made. Drafts and source transcriptions always require advocate review. Existing legal checks/rules were not independently revalidated as part of this UI change.

The dependency audit has no high/critical production advisories; it reports an existing moderate `mammoth → argparse → sprintf-js` chain. Do not force a breaking downgrade automatically.
