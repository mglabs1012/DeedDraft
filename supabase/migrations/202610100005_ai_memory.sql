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
