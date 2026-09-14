-- Sprint 3 — reservations, calendar blocks, and the anti-double-booking
-- guarantee (spec sections 6, 7, 8). This is the most important migration
-- in the project: the EXCLUDE constraint below makes double-booking
-- impossible at the database level, not just "checked" at the application
-- level — no race condition, no concurrent-request window, can defeat it.

create type public.reservation_status as enum (
  'inquiry', 'pending', 'confirmed', 'modified', 'cancelled', 'completed', 'no_show'
);

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guest_first_name text not null check (char_length(trim(guest_first_name)) > 0),
  guest_last_name text not null check (char_length(trim(guest_last_name)) > 0),
  guest_email text,
  guest_phone text,
  num_guests integer not null default 1 check (num_guests > 0),
  check_in date not null,
  check_out date not null,
  -- Generated from check_in/check_out so the exclusion constraint below can
  -- index it with GiST. '[)' = check-in night included, check-out night not
  -- — a checkout on the 10th and a check-in on the 10th do not overlap.
  stay_range daterange generated always as (daterange(check_in, check_out, '[)')) stored,
  nightly_price numeric(10, 2) not null default 0 check (nightly_price >= 0),
  cleaning_fee numeric(10, 2) not null default 0 check (cleaning_fee >= 0),
  extra_fees numeric(10, 2) not null default 0 check (extra_fees >= 0),
  discount numeric(10, 2) not null default 0 check (discount >= 0),
  status public.reservation_status not null default 'confirmed',
  -- MVP is iCal-only (see docs/architecture): "source" identifies where a
  -- reservation came from without needing the full channels/channel-sync
  -- tables yet. external_id is reserved for the OTA's own reservation id
  -- once channel-sync lands (Sprint 4+) — prevents re-importing duplicates.
  source text not null default 'direct',
  external_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint reservations_dates_valid check (check_out > check_in)
);

create index reservations_unit_id_idx on public.reservations(unit_id, check_in);
create index reservations_organization_id_idx on public.reservations(organization_id);

create trigger set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- Keep organization_id in sync with the unit, same pattern as units/properties.
create or replace function public.sync_reservation_organization_id()
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
  before insert or update of unit_id on public.reservations
  for each row execute function public.sync_reservation_organization_id();

-- ---------------------------------------------------------------------------
-- THE anti-double-booking guarantee.
-- Two reservations on the same unit cannot have overlapping stay_range as
-- long as neither is cancelled. This is enforced by PostgreSQL itself at
-- INSERT/UPDATE time — a concurrent request racing to book the same dates
-- gets a database error (23P01, exclusion_violation), not a silent
-- double-booking. Requires btree_gist (enabled in 0001_extensions.sql) for
-- the uuid equality operator to work inside a GiST index.
-- ---------------------------------------------------------------------------
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (unit_id with =, stay_range with &&)
  where (status <> 'cancelled');

-- ---------------------------------------------------------------------------
-- calendar_blocks — manual blocks (maintenance, owner use, etc.), independent
-- of any reservation. Same overlap protection, scoped to blocks themselves.
-- ---------------------------------------------------------------------------
create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  block_range daterange generated always as (daterange(start_date, end_date, '[)')) stored,
  reason text not null default 'other' check (reason in ('maintenance', 'owner', 'other')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint calendar_blocks_dates_valid check (end_date > start_date)
);

create index calendar_blocks_unit_id_idx on public.calendar_blocks(unit_id, start_date);
create index calendar_blocks_organization_id_idx on public.calendar_blocks(organization_id);

create or replace function public.sync_block_organization_id()
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
  before insert or update of unit_id on public.calendar_blocks
  for each row execute function public.sync_block_organization_id();

alter table public.calendar_blocks
  add constraint calendar_blocks_no_overlap
  exclude using gist (unit_id with =, block_range with &&);

-- ---------------------------------------------------------------------------
-- RLS — reservations
-- Deliberately no DELETE policy: reservations are never hard-deleted, only
-- cancelled (status = 'cancelled'), so the audit trail and revenue history
-- stay intact. This is enforced here, not just by convention in the app.
-- ---------------------------------------------------------------------------
alter table public.reservations enable row level security;

create policy "members can view their organization's reservations"
  on public.reservations for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can create reservations"
  on public.reservations for insert
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can update reservations"
  on public.reservations for update
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- RLS — calendar_blocks
-- ---------------------------------------------------------------------------
alter table public.calendar_blocks enable row level security;

create policy "members can view their organization's calendar blocks"
  on public.calendar_blocks for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can create calendar blocks"
  on public.calendar_blocks for insert
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can delete calendar blocks"
  on public.calendar_blocks for delete
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));
