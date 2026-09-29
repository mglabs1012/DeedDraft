-- 0004: document text (OCR) cache, editable draft versions, AI chat history.

-- Text read from each uploaded paper, stored once and reused by extraction,
-- drafting chat and review (no repeated OCR cost).
alter table public.deed_documents
  add column if not exists extracted_text text,
  add column if not exists text_source text
    check (text_source in ('pdf-text', 'pdf-text-krutidev', 'docx', 'docx-krutidev', 'ai-ocr')),
  add column if not exists text_quality text check (text_quality in ('good', 'poor')),
  add column if not exists page_count integer,
  add column if not exists processed_at timestamptz;

-- Accept Word files (old Kruti Dev drafts, templates) and WebP phone photos.
update storage.buckets
   set allowed_mime_types = array[
     'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   ]
 where id = 'deed-documents';

-- Immutable, numbered versions of an edited draft (manual edits and AI chat edits).
create table if not exists public.deed_drafts (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references public.deeds(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  language text not null check (language in ('hindi', 'english')),
  version integer not null check (version > 0),
  content jsonb not null,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (deed_id, language, version)
);

create index if not exists deed_drafts_deed_idx on public.deed_drafts (deed_id, language, version desc);

alter table public.deed_drafts enable row level security;

drop policy if exists "members can view drafts" on public.deed_drafts;
create policy "members can view drafts"
on public.deed_drafts for select to authenticated
using (public.is_firm_member(firm_id));

drop policy if exists "members can save drafts" on public.deed_drafts;
create policy "members can save drafts"
on public.deed_drafts for insert to authenticated
with check (
  public.is_firm_member(firm_id)
  and created_by = auth.uid()
  and exists (select 1 from public.deeds d where d.id = deed_id and d.firm_id = firm_id)
);

drop policy if exists "members can delete drafts" on public.deed_drafts;
create policy "members can delete drafts"
on public.deed_drafts for delete to authenticated
using (public.is_firm_member(firm_id));

-- Conversation with the drafting assistant, kept per matter for audit.
create table if not exists public.deed_ai_messages (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references public.deeds(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deed_ai_messages_deed_idx on public.deed_ai_messages (deed_id, created_at);

alter table public.deed_ai_messages enable row level security;

drop policy if exists "members can view ai messages" on public.deed_ai_messages;
create policy "members can view ai messages"
on public.deed_ai_messages for select to authenticated
using (public.is_firm_member(firm_id));

drop policy if exists "members can add ai messages" on public.deed_ai_messages;
create policy "members can add ai messages"
on public.deed_ai_messages for insert to authenticated
with check (
  public.is_firm_member(firm_id)
  and user_id = auth.uid()
  and exists (select 1 from public.deeds d where d.id = deed_id and d.firm_id = firm_id)
);
