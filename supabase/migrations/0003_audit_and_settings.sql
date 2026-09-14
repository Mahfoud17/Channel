-- Sprint 1 — audit trail and per-organization settings (spec sections 38, 55).

-- ---------------------------------------------------------------------------
-- audit_logs — append-only. No update/delete policy is defined on purpose:
-- RLS denies any operation with no matching policy, so once a row lands here
-- it cannot be altered or removed through the API, only read.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  source text not null default 'app',
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

alter table public.audit_logs enable row level security;

create policy "members can view their organization's audit log"
  on public.audit_logs for select
  using (public.is_org_member(organization_id));

create policy "members can write audit entries"
  on public.audit_logs for insert
  with check (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- settings — key/value configuration per organization, editable without a
-- redeploy (commissions, seuils d'alerte, durées de ménage, etc. — spec §55).
-- ---------------------------------------------------------------------------
create table public.settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, key)
);

create trigger set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;

create policy "members can view their organization's settings"
  on public.settings for select
  using (public.is_org_member(organization_id));

create policy "admins can write settings"
  on public.settings for all
  using (public.has_org_role(organization_id, array['admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['admin']::public.org_role[]));
