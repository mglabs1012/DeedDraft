# Standard Mode

## Guided first-use tutorial

- On first visiting the signed-in Home, template picker, workspace and draft view, a short spotlight tour explains that screen. Next, Back, Got it, Skip tutorial and Escape are supported.
- Guides open by themselves only for a new account (created within the last 14 days), once per screen. Existing users are never interrupted. Skip stops automatic guides permanently; Quick tour in the header still replays the current screen's guide. Preferences are saved to the user's account (Supabase `user_metadata.tour`) and merged with this browser's local copy, so they follow the user across devices.
- Small question-mark controls provide hover, keyboard-focus and tap help for uploads, optional modules and drafting instructions. Escape dismisses help.
- The walkthrough never creates a deed, selects a template, uploads papers or invokes AI. Those actions remain explicit user choices. Legal review reminders appear before drafting and exporting.
- Browser verification used an isolated synthetic preview (removed after testing), because the preview browser was signed out. Verified auto-start, Next/Back, completion persistence, next-screen guidance, Escape/Skip persistence, replay and tap help. Signed-in integration still needs a user smoke test.

## November 5 pass: Premium Mode, Word export, fixes

- **Premium Mode** (`data.workspace.mode = "premium"`): chosen on Home or on New deed (`/app/deeds/new?mode=premium`, core deed types only; library templates stay Standard). The deed opens in a sectioned workspace with a sidebar (scrolling tabs on phones): Overview → Papers → People → Property → Title history → Payments → Terms → Draft. Payments and Title history are hidden when the deed type has none. The active section is kept in the URL (`?tab=`), each section shows complete/needs-details status, and Previous/Next move through them. The Overview has a readiness bar, checklist, key facts, final checks and an **AI legal review** whose findings link to the section to fix. *Open in Standard/Premium* switches a deed's mode without losing data. Both modes share one workspace hook, so uploads, extraction, saving and drafting behave identically. Deed lists show a Premium badge.
- **Word export** is now a real `.docx` (the `docx` package): A4, registry margins, justified 1.5-line text, centred headings, numbered clauses, bordered boundary and rent tables with fixed column widths, side-by-side signature blocks, page numbers, and a Devanagari font for Hindi. Each language starts its own section. File names are made download-safe (Hindi is written in English letters; em dashes are replaced) because browsers renamed such downloads to "download".
- **People cards:** long file names and IDs no longer push the edit/delete buttons out of the card (grid columns are `minmax(0,1fr)` with truncation). A name that already has an honorific (श्रीमती, कुमारी, Dr. …) is not given a second one, and an unmarried woman is सुश्री/Ms.
- **Data fixes:** a stored person without a relation was silently dropped on load; it now defaults to S/o. Doubled full stops ("sq. ft..") in areas and release recitals are fixed.

## November 4 debugging pass

- **Translation (fast and reusable):** names, places and deed words are written in the draft language in four layers: the firm's spellings from its recent deeds, then a built-in dictionary of Rajasthan names, places and deed vocabulary (instant, free), then the AI only for unknown words (parallel batches on the fast model), then a rule-based transliteration when AI is unavailable. Values the AI did not convert are listed for review. The Draft tab has **Names in the draft language** to correct any spelling; corrections are reused for the firm's next deeds.
- **Hindi, English or both:** Step 4 offers *Both*; each language is saved as its own version.
- **Faster drafting:** with no instructions, the draft is built from the template instantly (no AI pass). With instructions, the AI applies them using the firm's accepted reference drafts as a style guide. Saving a section no longer re-renders the whole deed page on the server, papers are read two at a time, and large PDFs are split in linear time.
- **AI learning:** *Teach AI this style* on a saved draft keeps it (anonymised) as a firm reference. Extraction rules cover Hindi relations, salutations, deceased relatives, area units, boundaries and masked Aadhaar numbers; an unknown role is never silently a witness.
- **Workspace:** four numbered steps (papers → people → property, payment & terms → draft); Seller, Buyer, Witnesses in deed order; the draft reads as it will print and any paragraph opens for editing on click; on phones the AI assistant opens as a bottom sheet.
- **Removed:** the unreachable classic deed screen and its AI panels, the non-functional Hindi/English interface switch, and the disabled Premium Mode placeholder.
- **Security:** Next.js upgraded from 16.4.0 to 16.4.5 for a critical advisory. Zod 3 still has a high advisory whose fix requires the Zod 4 major upgrade.

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

The subsequent HTTP 400 after sending bytes was caused by sending signed tokens to the regular TUS endpoint. Signed uploads now use `/storage/v1/upload/resumable/sign` and the public API key, matching Supabase's signed-upload example. The fingerprint version was changed to avoid reusing sessions created at the wrong endpoint. Live synthetic tests verified 1,024-byte and 6,292,480-byte transfers and stored sizes; test objects were removed afterward. This transport test uses an administrator-issued signed token, not an end-user RLS or OCR/draft integration test. Run it explicitly with `npx tsx scripts/test-live-upload.ts` when needed; it is not part of offline `npm test`.

Migration `0008` additionally qualifies deed/firm correlations in metadata policies and validates storage paths. It is prepared locally, not automatically applied to the remote database. Run the complete SQL bundle before testing OCR and saved drafts.

## Verification and limitations

`npm test` includes synthetic ZIP and RAR fixtures, archive traversal/size/encryption checks, image normalization and multi-page TIFF, hidden module persistence, multiple parties and non-destructive extraction.

AI availability shown in the UI indicates credential configuration, not a guarantee of model access or extraction accuracy. No claim of measured “80% automation” is made. Drafts and source transcriptions always require advocate review. Existing legal checks/rules were not independently revalidated as part of this UI change.

The dependency audit has no high/critical production advisories; it reports an existing moderate `mammoth → argparse → sprintf-js` chain. Do not force a breaking downgrade automatically.
