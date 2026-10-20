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
2. The existing database migrations `0001`–`0006` are still required. This change needs **no additional database migration**: workspace settings live in the existing `deeds.data` JSON.
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
- Archive members become individual private documents. The original ZIP/RAR container is not retained.
- JPEG/PNG/WebP are retained. Other image formats are converted for OCR/storage; all TIFF pages are retained in a PDF. Only the first GIF frame and main HEIC image are used, with a visible conversion notice.
- Files use the existing private `deed-documents` bucket, scoped to firm/deed, with existing RLS. Converted images require no bucket MIME configuration change.
- The host must permit 21 MB Server Action requests and long-running OCR/model requests (up to 300 seconds). Some serverless hosts impose smaller limits regardless of Next configuration; use a compatible Node host or add a direct-upload ingestion worker before deploying there.
- Keep the page open during the sequential upload/extraction queue. If extraction fails, files stay saved and can be retried.

## Verification and limitations

`npm test` includes synthetic ZIP and RAR fixtures, archive traversal/size/encryption checks, image normalization and multi-page TIFF, hidden module persistence, multiple parties and non-destructive extraction.

AI availability shown in the UI indicates credential configuration, not a guarantee of model access or extraction accuracy. No claim of measured “80% automation” is made. Drafts and source transcriptions always require advocate review. Existing legal checks/rules were not independently revalidated as part of this UI change.

The dependency audit has no high/critical production advisories; it reports an existing moderate `mammoth → argparse → sprintf-js` chain. Do not force a breaking downgrade automatically.
