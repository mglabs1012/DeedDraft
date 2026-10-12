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
