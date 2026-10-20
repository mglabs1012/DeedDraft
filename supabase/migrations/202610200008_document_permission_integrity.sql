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
