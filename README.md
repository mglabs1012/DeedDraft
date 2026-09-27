# DeedDraft

DeedDraft is a secure, multi-tenant deed drafting workspace for Indian advocates and law firms. Phase 1 provides authentication, firm workspaces, deed tracking, document repositories, and drafting placeholders. It does not perform AI extraction or generate legal documents.

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project

## 1. Install dependencies

\`\`\`powershell
npm install
\`\`\`

## 2. Configure Supabase

Create a new Supabase project, then run both SQL files in order in the Supabase SQL Editor:

1. \`supabase/migrations/202609270001_init_deeddraft.sql\`
2. \`supabase/migrations/202609270002_shared_profile_reads.sql\`

The first migration creates all tables, RLS policies, triggers, the private \`deed-documents\` bucket, and Storage policies. Do not create a separate public bucket.

In **Authentication → URL Configuration**, add:

\`\`\`text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/**
\`\`\`

Ensure the Email provider is enabled in **Authentication → Providers**.

## 3. Add environment variables

\`\`\`powershell
Copy-Item .env.example .env.local
\`\`\`

Fill in \`.env.local\`:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_KEY
\`\`\`

The environment variable names retain the requested legacy naming, but current Supabase publishable and secret keys are supported. Never commit \`.env.local\`, and never expose the secret key to browser code.

## 4. Generate database types

The repository includes schema-mirrored types for development. After migration, authenticate the Supabase CLI and replace them with Supabase-generated types:

\`\`\`powershell
npx supabase login
npx supabase gen types typescript --project-id "YOUR_PROJECT_REF" --schema public | Set-Content -Encoding utf8 types\database.ts
\`\`\`

## 5. Run locally

\`\`\`powershell
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000). Create an account, confirm its email if confirmation is enabled, and finish onboarding to create your first firm.

## Optional demo data

The seed script creates one deliberately fake user, firm, and six sample deeds. It does not use real personal data.

\`\`\`powershell
npm run seed
\`\`\`

It creates:

\`\`\`text
Email: demo-advocate@deeddraft.example
Password: DemoOnly!2026
\`\`\`

Run it only on a development project.

## Checks

\`\`\`powershell
npm run lint
npm run build
\`\`\`

## Security model

- Every firm-scoped table has Supabase RLS enabled.
- Membership is checked through the \`is_firm_member\` helper function.
- Owner-only firm updates use the \`is_firm_owner\` helper.
- The document bucket is private and uses the required \`{firm_id}/{deed_id}/{file}\` path.
- The application creates time-limited signed URLs for document previews and downloads.
- The Supabase service-role/secret key is isolated in \`lib/supabase/admin.ts\`, a server-only module.
