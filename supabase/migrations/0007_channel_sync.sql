-- Sprint 4 — iCal channel sync (spec sections 5, 6; MVP is iCal-only per the
-- architecture decisions). Two independent flows:
--   import: pull an OTA's .ics feed into our reservations (channel_connections)
--   export: expose our own reservations as an .ics feed the OTA can import
--           (units.ical_export_token — the URL itself is the secret, no
--           separate auth, same trade-off already made for unit photos)

create type public.channel_type as enum ('airbnb', 'booking', 'vrbo', 'other');
create type public.sync_status as enum ('ok', 'error');

-- ---------------------------------------------------------------------------
-- Export: every unit gets an unguessable token for its outgoing iCal feed.
-- ---------------------------------------------------------------------------
alter table public.units
  add column ical_export_token uuid not null default gen_random_uuid();

alter table public.units
  add constraint units_ical_export_token_key unique (ical_export_token);

-- ---------------------------------------------------------------------------
-- Import: one row per "this unit imports from this OTA" connection.
-- ---------------------------------------------------------------------------
create table public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_type public.channel_type not null,
  ical_import_url text not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_sync_status public.sync_status,
  last_sync_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index channel_connections_unit_id_idx on public.channel_connections(unit_id);
create index channel_connections_organization_id_idx on public.channel_connections(organization_id);

create trigger set_updated_at
  before update on public.channel_connections
  for each row execute function public.set_updated_at();

create or replace function public.sync_channel_connection_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id
  from public.units
  where id = new.unit_id;

  if new.organization_id is null then
    raise exception 'unit % does not exist', new.unit_id;
  end if;

  return new;
end;
$$;

create trigger sync_organization_id
  before insert or update of unit_id on public.channel_connections
  for each row execute function public.sync_channel_connection_organization_id();

-- ---------------------------------------------------------------------------
-- sync_logs — observability (spec section 56). Written only by the trusted
-- server-side sync engine (service-role client, bypasses RLS) — regular
-- users can read their organization's logs but never write them directly.
-- ---------------------------------------------------------------------------
create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  channel_connection_id uuid not null references public.channel_connections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status public.sync_status not null,
  events_seen integer not null default 0,
  events_imported integer not null default 0,
  events_cancelled integer not null default 0,
  conflicts integer not null default 0,
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index sync_logs_connection_id_idx on public.sync_logs(channel_connection_id, started_at desc);
create index sync_logs_organization_id_idx on public.sync_logs(organization_id, started_at desc);

-- ---------------------------------------------------------------------------
-- RLS — channel_connections (managed by admins/managers, like properties/units)
-- ---------------------------------------------------------------------------
alter table public.channel_connections enable row level security;

create policy "members can view their organization's channel connections"
  on public.channel_connections for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can create channel connections"
  on public.channel_connections for insert
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can update channel connections"
  on public.channel_connections for update
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can delete channel connections"
  on public.channel_connections for delete
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- RLS — sync_logs (read-only from the API; writes go through service_role)
-- ---------------------------------------------------------------------------
alter table public.sync_logs enable row level security;

create policy "members can view their organization's sync logs"
  on public.sync_logs for select
  using (public.is_org_member(organization_id));
