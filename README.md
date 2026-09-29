# DeedDraft

DeedDraft is a secure, multi-tenant deed drafting workspace for Indian advocates and law firms, built around Rajasthan drafting practice. Advocates record a matter once — parties, property schedule with boundaries and side measurements, chain of title with Sub-Registrar references, consideration and payments, and deed-specific terms — and generate a registration-ready draft in **Hindi, English or both**, as a Word (.doc) file or PDF.

Supported instruments: Sale Deed (विक्रय पत्र), Agreement to Sell (विक्रय इकरारनामा), Gift Deed (दान पत्र), Release Deed (हक त्याग पत्र), Partition Deed (विभाजन पत्र), Will (वसीयतनामा), Lease Deed (पट्टा विलेख), Rent Deed (किरायानामा) and a custom deed.

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

Existing projects only need to run the migrations they have not applied yet. Until migration 3 is applied the app falls back to a non-atomic save; until migration 4 is applied, document text is not cached and edited drafts cannot be saved.

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

## AI features (OpenRouter)

DeedDraft uses [OpenRouter](https://openrouter.ai) so you can choose any model without code changes. Add to `.env.local` (see `.env.example`):

```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.5-flash          # any OpenRouter model id
OPENROUTER_EXTRACTION_MODEL=                      # optional, for document extraction / OCR only
OPENROUTER_FALLBACK_MODELS=                       # optional, comma list tried on 429 / outages
OPENROUTER_PDF_ENGINE=                            # optional: native | mistral-ocr | pdf-text
OPENROUTER_SITE_URL=https://your-domain
```

Without a key the app works normally and hides AI buttons. With a key:

- **Extract with AI** (Documents tab) — reads an uploaded paper (PDF or image up to 10 MB, including scans and Kruti Dev PDFs) and proposes parties, property, chain of title and payments. The advocate ticks what to keep; nothing is saved without review, filled fields are never overwritten and duplicates are skipped.
- **Draft clauses with AI** (Terms tab) — drafts additional clauses in Hindi or English, in Rajasthan drafting style, from plain instructions.
- **Read text** (Documents tab) — shows the text DeedDraft read from a paper and whether it is reliable. See *Document reading (OCR)* below.
- **Edit & chat with AI** (Generate tab) — the draft opens as editable clauses. Type instructions such as "add a clause that the buyer pays stamp duty" or "make para 4 simpler"; the AI proposes changes clause by clause, shown as before/after, and nothing changes until you press Apply. **Review** lists issues that jump to the clause. Save a version to keep it; the Preview/Word/PDF export can then use the edited version.
- **AI legal review** (Generate tab) — flags missing particulars, payment/consideration mismatches, TDS (s. 194-IA), missing registration references and instrument-specific risks.

How it is built: `lib/ai/openrouter.ts` (server-only client — the key never reaches the browser), `lib/ai/prompts.ts`, `lib/ai/parse.ts` (model output is untrusted: it is normalised and re-validated with the zod schemas), `app/actions/ai.ts` (firm-scoped server actions), and `lib/ai/contract.ts` (non-destructive merge). Prompts treat documents as data, not instructions. Aadhaar, PAN and contact numbers are stripped before clause drafting and review; document extraction necessarily sends the file itself to the chosen provider. Every call is logged in the activity log with the model, tokens and cost reported by OpenRouter.

### Document reading (OCR)

`lib/ocr/read.ts` reads each upload once and caches the text on the document row:

1. **PDF with a text layer** — the text is taken page by page for free (no AI call). Kruti Dev PDFs are converted to Unicode.
2. **Word (.docx)** — text is read directly.
3. **Scans, photos, or PDFs whose Hindi text is garbled** (detected from empty pages and broken vowel signs) — the file is sent to the AI for a verbatim transcription. Set `OPENROUTER_PDF_ENGINE=mistral-ocr` for the best results on scanned Hindi papers.

Extraction then works from that text, which is faster, cheaper and far less likely to hit rate limits than sending the file each time.

For best results, upload the original digital PDF (from the e-registration / Sub-Registrar portal) instead of a photo of a print. When scanning, use 300 dpi greyscale, flat pages, one document per file, with no shadows or cropped edges. Upload each paper under the correct category, and use **Read text** to check before extracting.

### "AI rate limit reached"

This is OpenRouter or the model provider returning HTTP 429. The usual causes are:

- a `:free` model, which is limited to about 20 requests a minute and 50 a day (1,000 a day after buying $10 of credits);
- a key with a credit limit that is used up;
- the upstream provider throttling a busy model.

To fix it:

1. Open **Settings → AI connection → Test AI connection**. It shows the plan, remaining credit and the exact provider error.
2. Use a paid model (for example `google/gemini-2.5-flash`) and add credits.
3. Set `OPENROUTER_FALLBACK_MODELS` so another model answers when one is throttled.

The client already retries 429/5xx responses with backoff, honouring `Retry-After`.

## Security model

- Every firm-scoped table has Supabase RLS enabled.
- Membership is checked through the `is_firm_member` helper function.
- Owner-only firm updates use the `is_firm_owner` helper.
- The document bucket is private and uses the required `{firm_id}/{deed_id}/{file}` path.
- The application creates time-limited signed URLs for document previews and downloads.
- The Supabase service-role/secret key is isolated in `lib/supabase/admin.ts`, a server-only module.
- Section saves go through `update_deed_section` (SECURITY INVOKER, so RLS still applies), updating one JSON section atomically so colleagues editing different sections never overwrite each other.
- Security headers (nosniff, frame denial, referrer policy, permissions policy, HSTS) are set in `next.config.ts`.
