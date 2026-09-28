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
