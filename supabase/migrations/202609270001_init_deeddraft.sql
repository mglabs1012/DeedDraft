create extension if not exists pgcrypto;

do $$ begin
  create type public.deed_type as enum
    ('sale', 'release', 'gift', 'partition', 'will', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.deed_status as enum
    ('draft', 'data_collection', 'under_review', 'generated', 'finalized');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.deed_language as enum
    ('english', 'hindi', 'bilingual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum
    ('owner', 'advocate', 'clerk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_category as enum
    ('naksha_map', 'id_proof', 'prior_title_deed', 'jamabandi',
     'payment_proof', 'photograph', 'other');
exception when duplicate_object then null; end $$;

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  city text not null check (char_length(trim(city)) > 0),
  state text not null default 'Rajasthan',
  bar_registration_no text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) > 0),
  phone text,
  created_at timestamptz not null default now()
);

create table public.firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'clerk',
  created_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

create table public.deeds (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete restrict,
  deed_type public.deed_type not null,
  title text not null check (char_length(trim(title)) > 0),
  reference_no text not null default '',
  language public.deed_language not null default 'english',
  status public.deed_status not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  remarks text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, reference_no)
);

create table public.deed_documents (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references public.deeds(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete restrict,
  category public.document_category not null default 'other',
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  deed_id uuid references public.deeds(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Private implementation detail used to create collision-free DD-YYYY-0001 references.
create table public.firm_deed_counters (
  firm_id uuid not null references public.firms(id) on delete cascade,
  reference_year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (firm_id, reference_year)
);

create index deeds_firm_updated_idx on public.deeds (firm_id, updated_at desc);
create index deeds_firm_status_idx on public.deeds (firm_id, status);
create index deed_documents_deed_idx on public.deed_documents (deed_id, category);
create index activity_log_deed_created_idx on public.activity_log (deed_id, created_at desc);

create or replace function public.is_firm_member(target_firm_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.firm_members
    where firm_id = target_firm_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_firm_owner(target_firm_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.firm_members
    where firm_id = target_firm_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.set_deed_reference_no()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  current_year integer := extract(year from current_date)::integer;
  next_number integer;
begin
  insert into public.firm_deed_counters as counter
    (firm_id, reference_year, last_number)
  values (new.firm_id, current_year, 1)
  on conflict (firm_id, reference_year)
  do update set last_number = counter.last_number + 1
  returning last_number into next_number;

  new.reference_no := format(
    'DD-%s-%s',
    current_year,
    lpad(next_number::text, 4, '0')
  );

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prevent_deed_tenant_change()
returns trigger
language plpgsql
as $$
begin
  if new.firm_id is distinct from old.firm_id
     or new.created_by is distinct from old.created_by then
    raise exception 'A deed cannot be moved to another firm or reassigned';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_document_tenant_change()
returns trigger
language plpgsql
as $$
begin
  if new.firm_id is distinct from old.firm_id
     or new.deed_id is distinct from old.deed_id then
    raise exception 'A document cannot be moved to another deed or firm';
  end if;
  return new;
end;
$$;

create trigger deeds_set_reference_no
before insert on public.deeds
for each row execute function public.set_deed_reference_no();

create trigger deeds_set_updated_at
before update on public.deeds
for each row execute function public.set_updated_at();

create trigger deeds_prevent_tenant_change
before update on public.deeds
for each row execute function public.prevent_deed_tenant_change();

create trigger documents_prevent_tenant_change
before update on public.deed_documents
for each row execute function public.prevent_document_tenant_change();

-- Called by the onboarding Server Action. It makes firm creation atomic and RLS-safe.
create or replace function public.create_firm_workspace(
  p_full_name text,
  p_phone text,
  p_firm_name text,
  p_city text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  new_firm_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.profiles (id, full_name, phone)
  values (auth.uid(), trim(p_full_name), nullif(trim(p_phone), ''))
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone;

  insert into public.firms (name, city)
  values (trim(p_firm_name), trim(p_city))
  returning id into new_firm_id;

  insert into public.firm_members (firm_id, user_id, role)
  values (new_firm_id, auth.uid(), 'owner');

  return new_firm_id;
end;
$$;

revoke all on function public.create_firm_workspace(text, text, text, text) from public;
grant execute on function public.create_firm_workspace(text, text, text, text) to authenticated;

alter table public.firms enable row level security;
alter table public.profiles enable row level security;
alter table public.firm_members enable row level security;
alter table public.deeds enable row level security;
alter table public.deed_documents enable row level security;
alter table public.activity_log enable row level security;
alter table public.firm_deed_counters enable row level security;

create policy "members can view their firms"
on public.firms for select to authenticated
using (public.is_firm_member(id));

create policy "owners can update their firms"
on public.firms for update to authenticated
using (public.is_firm_owner(id))
with check (public.is_firm_owner(id));

create policy "users can view their profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "users can create their profile"
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy "users can update their profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can view firm members"
on public.firm_members for select to authenticated
using (public.is_firm_member(firm_id));

create policy "members can view deeds"
on public.deeds for select to authenticated
using (public.is_firm_member(firm_id));

create policy "members can create deeds"
on public.deeds for insert to authenticated
with check (
  public.is_firm_member(firm_id)
  and created_by = auth.uid()
);

create policy "members can update deeds"
on public.deeds for update to authenticated
using (public.is_firm_member(firm_id))
with check (public.is_firm_member(firm_id));

create policy "members can delete deeds"
on public.deeds for delete to authenticated
using (public.is_firm_member(firm_id));

create policy "members can view deed documents"
on public.deed_documents for select to authenticated
using (public.is_firm_member(firm_id));

create policy "members can upload deed documents"
on public.deed_documents for insert to authenticated
with check (
  public.is_firm_member(firm_id)
  and uploaded_by = auth.uid()
  and exists (
    select 1 from public.deeds d
    where d.id = deed_id and d.firm_id = firm_id
  )
);

create policy "members can update deed documents"
on public.deed_documents for update to authenticated
using (public.is_firm_member(firm_id))
with check (public.is_firm_member(firm_id));

create policy "members can delete deed documents"
on public.deed_documents for delete to authenticated
using (public.is_firm_member(firm_id));

create policy "members can view activity"
on public.activity_log for select to authenticated
using (public.is_firm_member(firm_id));

create policy "members can add activity"
on public.activity_log for insert to authenticated
with check (
  public.is_firm_member(firm_id)
  and user_id = auth.uid()
  and (
    deed_id is null
    or exists (
      select 1 from public.deeds d
      where d.id = deed_id and d.firm_id = firm_id
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deed-documents',
  'deed-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_deed_storage_path(path_name text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  parts text[];
  path_firm_id uuid;
  path_deed_id uuid;
begin
  parts := string_to_array(path_name, '/');

  if coalesce(array_length(parts, 1), 0) <> 3 then
    return false;
  end if;

  path_firm_id := parts[1]::uuid;
  path_deed_id := parts[2]::uuid;

  return public.is_firm_member(path_firm_id)
    and exists (
      select 1 from public.deeds
      where id = path_deed_id and firm_id = path_firm_id
    );
exception
  when invalid_text_representation then return false;
end;
$$;

create policy "members can read firm deed storage"
on storage.objects for select to authenticated
using (
  bucket_id = 'deed-documents'
  and public.can_access_deed_storage_path(name)
);

create policy "members can upload firm deed storage"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'deed-documents'
  and public.can_access_deed_storage_path(name)
);

create policy "members can update firm deed storage"
on storage.objects for update to authenticated
using (
  bucket_id = 'deed-documents'
  and public.can_access_deed_storage_path(name)
)
with check (
  bucket_id = 'deed-documents'
  and public.can_access_deed_storage_path(name)
);

create policy "members can delete firm deed storage"
on storage.objects for delete to authenticated
using (
  bucket_id = 'deed-documents'
  and public.can_access_deed_storage_path(name)
);
