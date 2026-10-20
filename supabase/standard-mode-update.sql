-- Standard Mode database update: migrations 0003–0007.
-- Run this entire file in your Supabase project's SQL Editor.
-- Idempotent; does not delete deed records or change bucket visibility.

-- New deed categories drafted from real Rajasthan practice.
alter type public.deed_type add value if not exists 'agreement_to_sell';
alter type public.deed_type add value if not exists 'lease';
alter type public.deed_type add value if not exists 'rent';

-- Property-paper categories seen in real matters (for filing and future AI extraction).
alter type public.document_category add value if not exists 'patta';
alter type public.document_category add value if not exists 'loan_papers';
alter type public.document_category add value if not exists 'stamp_paper';

-- Atomically replaces one top-level section of deeds.data so that two people
-- editing different sections of the same matter never overwrite each other.
-- SECURITY INVOKER: the existing deeds RLS policies still decide access.
create or replace function public.update_deed_section(
  p_deed_id uuid,
  p_section text,
  p_value jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  result timestamptz;
begin
  if p_section not in (
    'parties', 'properties', 'titleChain', 'consideration',
    'payments', 'terms', 'execution'
  ) then
    raise exception 'Unknown deed section: %', p_section;
  end if;

  update public.deeds
     set data = jsonb_set(coalesce(data, '{}'::jsonb), array[p_section], p_value, true)
   where id = p_deed_id
  returning updated_at into result;

  if result is null then
    raise exception 'Deed not found';
  end if;

  return result;
end;
$$;

revoke all on function public.update_deed_section(uuid, text, jsonb) from public;
grant execute on function public.update_deed_section(uuid, text, jsonb) to authenticated;

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

-- 0005: AI drafting memory: firm drafting instructions and accepted reference drafts
-- that the AI follows when drafting, reviewing and answering questions.
-- Safe to run more than once.

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  kind text not null check (kind in ('note', 'reference')),
  deed_type public.deed_type,
  language text check (language in ('hindi', 'english')),
  title text not null default '',
  content text not null check (char_length(content) between 1 and 200000),
  source text not null default 'manual' check (source in ('manual', 'upload', 'finalized', 'ai', 'chat')),
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_memory_firm_kind_idx on public.ai_memory (firm_id, kind, deed_type, created_at desc);

alter table public.ai_memory enable row level security;

drop policy if exists "members can view ai memory" on public.ai_memory;
create policy "members can view ai memory"
on public.ai_memory for select to authenticated
using (public.is_firm_member(firm_id));

drop policy if exists "members can add ai memory" on public.ai_memory;
create policy "members can add ai memory"
on public.ai_memory for insert to authenticated
with check (public.is_firm_member(firm_id) and created_by = auth.uid());

drop policy if exists "members can update ai memory" on public.ai_memory;
create policy "members can update ai memory"
on public.ai_memory for update to authenticated
using (public.is_firm_member(firm_id))
with check (public.is_firm_member(firm_id));

drop policy if exists "members can delete ai memory" on public.ai_memory;
create policy "members can delete ai memory"
on public.ai_memory for delete to authenticated
using (public.is_firm_member(firm_id));

-- Allow the new deed data sections in the atomic section save.
create or replace function public.update_deed_section(
  p_deed_id uuid,
  p_section text,
  p_value jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  result timestamptz;
begin
  if p_section not in (
    'parties', 'properties', 'titleChain', 'consideration',
    'payments', 'terms', 'execution',
    'custom', 'localized', 'aiDraft', 'chat'
  ) then
    raise exception 'Unknown deed section: %', p_section;
  end if;

  update public.deeds
     set data = jsonb_set(coalesce(data, '{}'::jsonb), array[p_section], p_value, true)
   where id = p_deed_id
  returning updated_at into result;

  if result is null then
    raise exception 'Deed not found';
  end if;

  return result;
end;
$$;

revoke all on function public.update_deed_section(uuid, text, jsonb) from public;
grant execute on function public.update_deed_section(uuid, text, jsonb) to authenticated;

-- 0006: indexes for production workloads.
-- Safe to run more than once.

-- Recent-activity bell (layout) and the per-firm daily AI limit both read
-- activity by firm, newest first.
create index if not exists activity_log_firm_created_idx
  on public.activity_log (firm_id, created_at desc);

-- Daily AI limit counts only AI actions ("ai_…") in the last 24 hours.
create index if not exists activity_log_firm_ai_created_idx
  on public.activity_log (firm_id, created_at desc)
  where action like 'ai\_%';

-- Deeds list filtered by type (template library and dashboard filters).
create index if not exists deeds_firm_type_idx
  on public.deeds (firm_id, deed_type);

-- Firm membership lookup on every request (getCurrentWorkspace).
create index if not exists firm_members_user_created_idx
  on public.firm_members (user_id, created_at);

-- Browser-to-Storage resumable uploads; keep bucket private, size limit and RLS unchanged.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/tiff', 'image/bmp', 'image/avif', 'image/heic', 'image/heif',
  'application/zip', 'application/vnd.rar',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'deed-documents';

-- 0008: metadata permission integrity
-- Tighten metadata writes without relaxing private Storage access.
-- Qualify outer columns: d.firm_id = firm_id otherwise compares d to itself.
drop policy if exists "members can upload deed documents" on public.deed_documents;
create policy "members can upload deed documents"
on public.deed_documents for insert to authenticated
with check (
  public.is_firm_member(firm_id)
  and uploaded_by = auth.uid()
  and exists (select 1 from public.deeds d
    where d.id = deed_documents.deed_id and d.firm_id = deed_documents.firm_id)
  and split_part(storage_path, '/', 1) = firm_id::text
  and split_part(storage_path, '/', 2) = deed_id::text
  and public.can_access_deed_storage_path(storage_path)
);

drop policy if exists "members can update deed documents" on public.deed_documents;
create policy "members can update deed documents"
on public.deed_documents for update to authenticated
using (public.is_firm_member(firm_id))
with check (
  public.is_firm_member(firm_id)
  and exists (select 1 from public.deeds d
    where d.id = deed_documents.deed_id and d.firm_id = deed_documents.firm_id)
  and split_part(storage_path, '/', 1) = firm_id::text
  and split_part(storage_path, '/', 2) = deed_id::text
  and public.can_access_deed_storage_path(storage_path)
);

drop policy if exists "members can save drafts" on public.deed_drafts;
create policy "members can save drafts"
on public.deed_drafts for insert to authenticated
with check (
  public.is_firm_member(firm_id) and created_by = auth.uid()
  and exists (select 1 from public.deeds d
    where d.id = deed_drafts.deed_id and d.firm_id = deed_drafts.firm_id)
);

drop policy if exists "members can add ai messages" on public.deed_ai_messages;
create policy "members can add ai messages"
on public.deed_ai_messages for insert to authenticated
with check (
  public.is_firm_member(firm_id) and user_id = auth.uid()
  and exists (select 1 from public.deeds d
    where d.id = deed_ai_messages.deed_id and d.firm_id = deed_ai_messages.firm_id)
);


