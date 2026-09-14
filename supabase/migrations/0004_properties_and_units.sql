-- Sprint 2 — properties, units, and their photos (spec section 4).
-- A "property" is the physical address; a "unit" is the actually-rentable
-- entity (an apartment inside a building, a room, a whole house). Almost
-- everything downstream (calendar, reservations, pricing, cleaning) hangs
-- off unit_id, not property_id.

create type public.unit_status as enum ('active', 'inactive', 'maintenance');

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postal_code text not null,
  country text not null default 'FR',
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index properties_organization_id_idx on public.properties(organization_id);

create trigger set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- units
-- organization_id is denormalized from properties so every RLS policy below
-- (and every future table that hangs off unit_id — reservations, cleaning,
-- pricing…) can filter on a single indexed column instead of joining
-- through properties on every query.
-- ---------------------------------------------------------------------------
create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  unit_type text not null default 'appartement',
  bedrooms integer not null default 1 check (bedrooms >= 0),
  beds integer not null default 1 check (beds >= 0),
  bathrooms numeric(3, 1) not null default 1 check (bathrooms >= 0),
  max_guests integer not null default 2 check (max_guests > 0),
  area_sqm numeric(6, 1),
  floor text,
  has_elevator boolean not null default false,
  has_parking boolean not null default false,
  status public.unit_status not null default 'active',
  amenities text[] not null default '{}',
  access_instructions text,
  keybox_code text,
  wifi_ssid text,
  wifi_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index units_property_id_idx on public.units(property_id);
create index units_organization_id_idx on public.units(organization_id);

create trigger set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

-- Keep units.organization_id in lockstep with its property — set on insert,
-- re-derived if a unit is ever reassigned to a different property.
create or replace function public.sync_unit_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id
  from public.properties
  where id = new.property_id;

  if new.organization_id is null then
    raise exception 'property % does not exist', new.property_id;
  end if;

  return new;
end;
$$;

create trigger sync_organization_id
  before insert or update of property_id on public.units
  for each row execute function public.sync_unit_organization_id();

-- ---------------------------------------------------------------------------
-- unit_photos — metadata only; bytes live in Supabase Storage
-- (bucket "unit-photos", see 0005_storage_unit_photos.sql).
-- ---------------------------------------------------------------------------
create table public.unit_photos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index unit_photos_unit_id_idx on public.unit_photos(unit_id, position);

-- ---------------------------------------------------------------------------
-- RLS — properties
-- ---------------------------------------------------------------------------
alter table public.properties enable row level security;

create policy "members can view their organization's properties"
  on public.properties for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can create properties"
  on public.properties for insert
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can update properties"
  on public.properties for update
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins can delete properties"
  on public.properties for delete
  using (public.has_org_role(organization_id, array['admin']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- RLS — units
-- ---------------------------------------------------------------------------
alter table public.units enable row level security;

create policy "members can view their organization's units"
  on public.units for select
  using (public.is_org_member(organization_id));

-- organization_id is set by the sync_organization_id BEFORE INSERT trigger
-- above, which runs before this CHECK is evaluated — the client only ever
-- supplies property_id, so checking organization_id here is both correct
-- and race-free (no window where a mismatched org could slip through).
create policy "admins and managers can create units"
  on public.units for insert
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can update units"
  on public.units for update
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins can delete units"
  on public.units for delete
  using (public.has_org_role(organization_id, array['admin']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- RLS — unit_photos
-- ---------------------------------------------------------------------------
alter table public.unit_photos enable row level security;

create policy "members can view their organization's unit photos"
  on public.unit_photos for select
  using (
    exists (
      select 1 from public.units u
      where u.id = unit_id and public.is_org_member(u.organization_id)
    )
  );

create policy "admins and managers can attach unit photos"
  on public.unit_photos for insert
  with check (
    exists (
      select 1 from public.units u
      where u.id = unit_id
        and public.has_org_role(u.organization_id, array['admin', 'manager']::public.org_role[])
    )
  );

create policy "admins and managers can remove unit photos"
  on public.unit_photos for delete
  using (
    exists (
      select 1 from public.units u
      where u.id = unit_id
        and public.has_org_role(u.organization_id, array['admin', 'manager']::public.org_role[])
    )
  );
