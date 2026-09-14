-- Sprint 1 — organizations, membership/roles, and the RLS foundation every
-- later table builds on. See docs/architecture (section B/D) for context.

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at current on every UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles — matches spec section 3 (Administrateur / Gestionnaire / Femme de
-- ménage / Propriétaire). "owner" here is the read-only owner-portal role;
-- property ownership itself is modeled separately in the `owners` table
-- (Sprint 12), a person can hold both.
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('admin', 'manager', 'cleaner', 'owner');
create type public.member_status as enum ('invited', 'active', 'disabled');

-- ---------------------------------------------------------------------------
-- organizations — the tenant boundary. Every business table carries
-- organization_id and is isolated from other tenants by RLS, not just by
-- application-level filtering.
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members — links auth.users to an organization with a role.
-- One user can belong to several organizations (e.g. a cleaner working for
-- two agencies) with a different role in each.
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null,
  status public.member_status not null default 'active',
  invited_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create trigger set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

create index organization_members_user_id_idx on public.organization_members(user_id);
create index organization_members_org_id_idx on public.organization_members(organization_id);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies across every future table.
-- SECURITY DEFINER + fixed search_path so they can be called safely from
-- policies without re-triggering RLS on organization_members themselves.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.org_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — organizations
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;

create policy "members can view their organization"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "any authenticated user can create an organization"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "admins can update their organization"
  on public.organizations for update
  using (public.has_org_role(id, array['admin']::public.org_role[]));

-- The creator of an organization is made its admin automatically —
-- there is no open policy that lets someone insert an arbitrary
-- organization_members row for themselves.
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role, status)
  values (new.id, auth.uid(), 'admin', 'active');
  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ---------------------------------------------------------------------------
-- RLS — organization_members
-- ---------------------------------------------------------------------------
alter table public.organization_members enable row level security;

create policy "members can view their organization's roster"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

create policy "admins can invite and edit members"
  on public.organization_members for insert
  with check (public.has_org_role(organization_id, array['admin']::public.org_role[]));

create policy "admins can update members"
  on public.organization_members for update
  using (public.has_org_role(organization_id, array['admin']::public.org_role[]));

create policy "admins can remove members"
  on public.organization_members for delete
  using (public.has_org_role(organization_id, array['admin']::public.org_role[]));
