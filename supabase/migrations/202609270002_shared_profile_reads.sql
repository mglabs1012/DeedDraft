create or replace function public.shares_firm_with(target_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.firm_members mine
    join public.firm_members theirs on theirs.firm_id = mine.firm_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

drop policy if exists "users can view their profile" on public.profiles;

create policy "members can view profiles in shared firms"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.shares_firm_with(id)
);
