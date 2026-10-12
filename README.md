# DeedDraft

DeedDraft is a secure, multi-tenant deed drafting workspace for Indian advocates and law firms, built around Rajasthan drafting practice. Advocates record a matter once — parties, property schedule with boundaries and side measurements, chain of title with Sub-Registrar references, consideration and payments, and deed-specific terms — and generate a registration-ready draft in **Hindi, English or both**, as a Word (.doc) file or PDF.

Guided instruments: Sale Deed (विक्रय पत्र), Agreement to Sell (विक्रय इकरारनामा), Gift Deed (दान पत्र), Release Deed (हक त्याग पत्र), Partition Deed (विभाजन पत्र), Will (वसीयतनामा), Lease Deed (पट्टा विलेख), Rent Deed (किरायानामा) and a custom deed, plus a searchable library of about 950 other templates (see Template library).

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project

## 1. Install dependencies

```powershell
npm install
```

## 2. Configure Supabase

Create a new Supabase project, then run the SQL files in order in the Supabase SQL Editor:

1. `supabase/migrations/202609270001_init_deeddraft.sql`
2. `supabase/migrations/202609270002_shared_profile_reads.sql`
3. `supabase/migrations/202609270003_more_deed_types.sql` — adds Agreement to Sell, Lease and Rent deed types, new document categories and the atomic `update_deed_section` function
4. `supabase/migrations/202609290004_ocr_drafts_chat.sql` — caches the text read from each document (OCR), allows Word/WebP uploads, and adds saved draft versions (`deed_drafts`) and the AI chat history (`deed_ai_messages`)

5. `supabase/migrations/202610100005_ai_memory.sql` — adds the `ai_memory` table (firm drafting instructions and accepted reference drafts) and allows the AI sections in `update_deed_section`
6. `supabase/migrations/202610120006_performance_indexes.sql` — indexes for the activity feed, the daily AI limit, deed filters and the per-request membership lookup (safe to re-run)

Existing projects only need to run the migrations they have not applied yet. Until migration 3 is applied the app falls back to a non-atomic save; until migration 4 is applied, document text is not cached and edited drafts cannot be saved; until migration 5 is applied, AI memory stays off (the built-in reference drafts still work).

The first migration creates all tables, RLS policies, triggers, the private `deed-documents` bucket, and Storage policies. Do not create a separate public bucket.

In **Authentication → URL Configuration**, add:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/**
```

Ensure the Email provider is enabled in **Authentication → Providers**.

## 3. Add environment variables

```powershell
Copy-Item .env.example .env.local
```

Fill in `.env.local` (all variables, including the optional AI ones, are listed in `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_KEY
```

The environment variable names retain the requested legacy naming, but current Supabase publishable and secret keys are supported. Never commit `.env.local`, and never expose the secret key to browser code.

## 4. Generate database types

The repository includes schema-mirrored types for development. After migration, authenticate the Supabase CLI and replace them with Supabase-generated types:

```powershell
npx supabase login
npx supabase gen types typescript --project-id "YOUR_PROJECT_REF" --schema public | Set-Content -Encoding utf8 types\database.ts
```

## 5. Run locally

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account, confirm its email if confirmation is enabled, and finish onboarding to create your first firm.

## Optional demo data

The seed script creates one deliberately fake user, firm, and six sample deeds. It does not use real personal data.

```powershell
npm run seed
```

It creates:

```text
Email: demo-advocate@deeddraft.example
Password: DemoOnly!2026
```

Run it only on a development project.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` runs fast checks of the drafting engine against real-world values (Hindi amount words, e-stamp duty and surcharges, lease escalation schedule, rent term dates, Kruti Dev conversion) and renders every deed type in every language.

## Troubleshooting: page shows no styling

If pages render as plain unstyled HTML, the browser is loading a stylesheet from an older build. Stop every running `npm run dev` / `npm run start`, delete the build cache, and start again:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

Then hard-refresh the browser (Ctrl+Shift+R). Never run `npm run build` while `npm run start` is serving the same folder.

## How drafting works

| Piece | Location |
| --- | --- |
| Deed-type registry (labels, Hindi party terms, tabs, terms, languages) | `lib/deed-types.ts` |
| Structured matter data (single contract for UI, drafting and AI) | `lib/schemas/deed-data.ts` |
| Drafting engine: Hindi numbers/dates, formatting, shared clauses | `lib/drafting/` |
| Templates per instrument | `lib/drafting/templates/` |
| Rajasthan stamp-duty estimate | `lib/stamp-duty.ts` |
| Kruti Dev 010 → Unicode converter for legacy Hindi papers | `lib/text/krutidev.ts` |
| AI integration contract (context + non-destructive merge) | `lib/ai/contract.ts` |
| Editable drafts (clause blocks, AI edit operations) | `lib/drafting/editable.ts` |
| Optional clause library per deed type | `lib/drafting/clause-library.ts` |
| Document reading / OCR pipeline | `lib/ocr/` |

Templates return typed blocks (paragraphs, numbered clauses, boundary tables, signatures) that one renderer turns into HTML, so every user value is escaped in one place and future AI features can insert or rewrite individual clauses. Hindi drafts pick the correct gendered and plural party terms (विक्रेता / विक्रेती / विक्रेतीगण), write amounts in Hindi words (अक्षरे … रूपये मात्र) and state areas as sq. m. = sq. yd. = sq. ft.

To add a deed type: add an enum value in a migration, add an entry to `lib/deed-types.ts`, and add a template to `lib/drafting/templates`. The new-deed picker, tabs, checklist and template library pick it up automatically.

## Template library

Besides the eight guided deeds (Sale, Agreement to Sell, Gift, Release, Partition, Will, Lease, Rent — always shown first), DeedDraft ships a searchable library of about 950 templates built from the Word files in `Real Templates of Deeds/Agreements to Nivesh`: affidavits, indemnity bonds, notices (including cheque bounce under s. 138), loans and promissory notes, power of attorney, partnership, employment letters, company resolutions and more.

- **Search** works in English, Hinglish and Hindi (e.g. "kiraya", "वसीयत", "power attorney") on the Templates page and under **Other documents** when starting a new document.
- **Each template gets a simple form** for its category (people, property, money, dates…), with extra questions for some titles (cheque details for cheque-bounce notices, beneficiaries for wills, etc.). See `lib/templates/forms.ts`.
- **Drafting:** Claude fills the template with the answers in English or Hindi, keeps blanks for anything not given, and adapts the ~170 US-format templates (marked "US format") to Indian practice. The draft can be edited and downloaded as Word or PDF. Without AI, the blank template can still be downloaded.
- Two executed deeds containing personal data and a few guides that are not templates are excluded.

To add or change templates, put `.docx` files in that folder and rebuild:

```powershell
npm run templates:build
```

This writes `lib/templates/library-index.json` (titles and categories) and `data/template-library/texts.json` (template text, read on the server). Categories are assigned by title rules in `scripts/build-template-library.ts`.

## AI features (Claude on Amazon Bedrock)

DeedDraft calls Claude Sonnet 4.6 through the Amazon Bedrock **Converse API** (`@aws-sdk/client-bedrock-runtime`, `ConverseCommand`). Each call waits for the complete response; nothing is streamed. Add to `.env.local` (see `.env.example`) and restart `npm run dev`:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...                        # IAM user with AmazonBedrockFullAccess
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-6
BEDROCK_EXTRACTION_MODEL_ID=                     # optional, for document reading only
BEDROCK_FAST_MODEL_ID=global.anthropic.claude-haiku-4-5-20251001-v1:0   # optional, quick tasks (name conversion, anonymising)
```

The IAM user needs `bedrock:InvokeModel` (part of `AmazonBedrockFullAccess`). The `global.` inference profile lets AWS serve requests from any region with capacity.

Bedrock limits each request to 5 PDF documents of 4.5 MB and images of 3.75 MB. DeedDraft handles this for you: larger PDFs are split by pages (up to 5 parts) and large photos are resized before sending. Uploads may be up to 20 MB.

Without a key the app works normally and hides AI buttons. With a key:

- **Fill from Aadhaar, PAN or ID** (Parties tab → Add from Aadhaar / PAN, or Add / Edit party) — upload the person's Aadhaar front and back, PAN, voter ID or passport. Name, relation and father/husband name, age, address, Aadhaar and PAN fill the empty fields of the form, and the uploaded papers are linked to that person (shown on their card; click to open).
- **Fill from naksha, map or layout plan** (Add / Edit property) — upload the naksha, site or layout plan, patta, jamabandi or khatauni. The four boundaries and side measurements, plot dimensions, area, built-up / carpet / super built-up area, plot / house / flat / floor / ward / survey / khasra / khata / khatauni / patta numbers and the land-use category fill the empty fields.
- **Extract with AI** (Documents tab) — reads any uploaded paper (PDF or image up to 20 MB, including scans and Kruti Dev PDFs) and proposes parties, property, chain of title and payments. The advocate ticks what to keep.
- **Draft clauses with AI** (Terms tab) — drafts additional clauses in Hindi or English, in Rajasthan drafting style, from plain instructions.
- **Read text** (Documents tab) — shows the text DeedDraft read from a paper and whether it is reliable. See *Document reading (OCR)* below.
- **Edit & chat with AI** (Generate tab) — the draft opens as editable clauses. Type instructions such as "add a clause that the buyer pays stamp duty" or "make para 4 simpler"; the AI proposes changes clause by clause, shown as before/after, and nothing changes until you press Apply. **Review** lists issues that jump to the clause. Save a version to keep it; the Preview/Word/PDF export can then use the edited version.
- **AI legal review** (Generate tab) — flags missing particulars, payment/consideration mismatches, TDS (s. 194-IA), missing registration references and instrument-specific risks.
- **Hindi ⇄ English without retyping** (Generate tab) — names, addresses, boundaries and other typed values are converted automatically into the draft's script (केसर देवी ⇄ Kesar Devi) when the chosen draft language differs from what was typed. Conversions are saved, shown under "Converted names & addresses" and can be corrected.
- **Refine with AI** (Generate tab) — polishes the standard draft so it reads like the firm's accepted, registered drafts: structure, clause order, formal phrases, grammar and gender agreement, plus clauses the client instructions call for. The model returns only edits; every edit is checked so no number (amount, date, area, registration detail) or typed particular (name, relation, address, boundary) changes, and identity numbers are replaced by tokens before sending. The "AI refined / Standard" switch compares both, and the refinement is marked out of date when the matter changes.
- **AI memory** (Settings → AI memory) — drafting instructions the AI always follows, accepted drafts uploaded as PDF, Word, photo or pasted text (read, Kruti Dev corrected and anonymised automatically), "Learn my style" to turn accepted drafts into instructions, and "Save to AI memory" on a finished draft. Ten anonymised real Rajasthan deeds (sale, agreement to sell, gift, lease, rent) ship as built-in references (`data/reference-drafts.json`, rebuilt with `npm run references:build`).
- **Ask AI** (every deed) — a chat that knows the matter, the current draft and the firm's memory; answers in Hindi, Hinglish or English, offers clauses that can be added to the deed with one tap, and saves "remember this" preferences to AI memory.

**OCR and reliability.** Photos are straightened, contrast-corrected and resized to the size Claude reads at; PDFs typed in the legacy Kruti Dev font have their text layer converted to Unicode and sent alongside the page images; Aadhaar numbers are checked against their Verhoeff check digit and misreads are flagged. All AI replies use structured output (a forced tool call with a JSON schema), long stable context (memory, references, matter) is prompt-cached, Bedrock throttling is retried with adaptive back-off, and every call logs tokens, cache hits and latency in the activity log.

Nothing is saved without review: autofill only fills empty fields of the open form, and files uploaded for autofill are kept in the matter's document repository (ID proof or Naksha / map).

How it is built: `lib/ai/claude.ts` (server-only Bedrock client — AWS credentials never reach the browser), `lib/ai/memory.server.ts` and `lib/ai/references.server.ts` (AI memory), `lib/drafting/localize.ts` (script conversion), `lib/drafting/segments.ts` (edit-based refinement and safety checks), `lib/ai/redact.ts`, `lib/ai/prompts.ts`, `lib/ai/parse.ts` (model output is untrusted: it is normalised and re-validated with the zod schemas), `app/actions/ai.ts` (firm-scoped server actions), `components/deeds/ai/autofill-panel.tsx`, and `lib/ai/contract.ts` (non-destructive merge). Prompts treat documents as data, not instructions. Aadhaar, PAN and contact numbers are stripped before clause drafting and review; document reading necessarily sends the file itself to Bedrock. Every call is logged in the activity log with the model and token counts.

### Document reading (OCR)

`lib/ocr/read.ts` reads each upload once and caches the text on the document row:

1. **PDF with a text layer** — the text is taken page by page for free (no AI call). Kruti Dev PDFs are converted to Unicode.
2. **Word (.docx)** — text is read directly.
3. **Scans, photos, or PDFs whose Hindi text is garbled** (detected from empty pages and broken vowel signs) — the file is sent to Claude on Bedrock for a verbatim transcription; large PDFs are split to Bedrock's limits and photos are straightened and resized first.

Extraction then works from that text, which is faster and cheaper than sending the file each time.

For best results, upload the original digital PDF (from the e-registration / Sub-Registrar portal) instead of a photo of a print. When scanning, use 300 dpi greyscale, flat pages, one document per file, with no shadows or cropped edges. Upload each paper under the correct category, and use **Read text** to check before extracting.

### "AI is busy" or other AI errors

Open **Settings → AI connection → Test AI connection**. It shows the AWS region and the drafting, reading and fast models, and the exact error from Bedrock.

- **Busy / throttled** — Bedrock limits requests per minute for each model. The client already retries with adaptive back-off; for sustained heavy use, request a higher quota for the model in **AWS Service Quotas**.
- **Access denied** — the IAM user needs `bedrock:InvokeModel` (included in `AmazonBedrockFullAccess`) and the model must be available to the account in the region.
- **Model not found** — check `BEDROCK_MODEL_ID` / `BEDROCK_FAST_MODEL_ID` against the inference profiles listed in the Bedrock console for your region.

## Security model

- Every firm-scoped table has Supabase RLS enabled.
- Membership is checked through the `is_firm_member` helper function.
- Owner-only firm updates use the `is_firm_owner` helper.
- The document bucket is private and uses the required `{firm_id}/{deed_id}/{file}` path.
- The application creates time-limited signed URLs for document previews and downloads.
- The Supabase service-role/secret key is isolated in `lib/supabase/admin.ts`, a server-only module.
- Section saves go through `update_deed_section` (SECURITY INVOKER, so RLS still applies), updating one JSON section atomically so colleagues editing different sections never overwrite each other.
- Security headers are set in `next.config.ts`: a Content-Security-Policy that allows scripts, frames and connections only from the site and its Supabase project, plus nosniff, frame denial, referrer policy, permissions policy, COOP and HSTS. Signed-in pages are sent with `Cache-Control: private, no-store` and `noindex`; `robots.txt` keeps crawlers out of the workspace.
- Database and storage errors are shown to users as plain messages (`lib/errors.ts`); codes and table names are only logged on the server.
- After sign-in, users return to the page they opened, but only same-site `/app` paths are followed (no open redirects).

## Running in production

- **Health check:** `GET /api/health` returns `{"status":"ok","database":"ok","ai":"configured"}` (HTTP 200), or HTTP 503 when the database is unreachable. Point your uptime monitor at it. It reveals no secrets or user data.
- **Logs:** every uncaught server error is logged as one JSON line (`instrumentation.ts`) with a `digest`; the same reference appears on the user's error page, so a screenshot is enough to find the log entry. Missing or half-filled environment variables are reported at start-up.
- **AI limits:** each user may make `AI_LIMIT_PER_MINUTE` AI requests a minute (default 20) and each firm `AI_LIMIT_PER_DAY` in 24 hours (default 500), so a stuck button or a shared login cannot run up the Bedrock bill. Set either to `0` to switch it off. The daily count uses the activity log, so it holds across server instances; run migration 6 for its index.
- **Final check:** the Generate tab runs instant, rule-based checks before printing — minors signing, duplicate Aadhaar/PAN, PAN above ₹10 lakh (Rule 114B), 1% TDS at ₹50 lakh (s. 194-IA), Will attestation by two witnesses (s. 63), leases over a year needing registration (s. 17), the four-month presentation limit (s. 23), overpayment, missing areas and blanks left in the draft. Problems marked red block "Mark as generated".
- **Performance:** deed lists load only summary columns, the deed page never sends stored OCR text to the browser, and the signed-in user, membership and firm are read once per request.
- **Upgrading Next.js:** keep `next` and `eslint-config-next` on the same version and run `npm run build` before deploying.
