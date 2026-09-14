-- Sprint 9 — competitor comp set (spec sections 10-11). Manual entry: the
-- architecture decisions explicitly rule out scraping (ToS/legal risk) and
-- no paid data provider is configured yet — this is designed to plug into
-- one later (competitor_prices.source distinguishes "manual" from a future
-- provider name) without changing the shape of anything above it.

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- the comp set is scoped to the unit it's being compared against
  unit_id uuid not null references public.units(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  platform text,
  url text,
  city text,
  unit_type text,
  bedrooms integer,
  max_guests integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index competitors_unit_id_idx on public.competitors(unit_id);
create index competitors_org_id_idx on public.competitors(organization_id);

create trigger set_updated_at
  before update on public.competitors
  for each row execute function public.set_updated_at();

create or replace function public.sync_competitor_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id from public.units where id = new.unit_id;
  if new.organization_id is null then
    raise exception 'unit % does not exist', new.unit_id;
  end if;
  return new;
end;
$$;

create trigger sync_organization_id
  before insert or update of unit_id on public.competitors
  for each row execute function public.sync_competitor_organization_id();

-- ---------------------------------------------------------------------------
-- competitor_prices — one row per observed price on a given date. A typo
-- on today's entry can be corrected (upsert on competitor_id+observed_date),
-- but there's no delete policy — the historical series a future chart
-- would read can't be quietly erased, only corrected going forward.
-- ---------------------------------------------------------------------------
create table public.competitor_prices (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  observed_date date not null,
  price numeric(10, 2) not null check (price >= 0),
  currency text not null default 'EUR',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (competitor_id, observed_date)
);

create index competitor_prices_competitor_idx on public.competitor_prices(competitor_id, observed_date desc);

create or replace function public.sync_competitor_price_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id from public.competitors where id = new.competitor_id;
  if new.organization_id is null then
    raise exception 'competitor % does not exist', new.competitor_id;
  end if;
  return new;
end;
$$;

create trigger sync_organization_id
  before insert on public.competitor_prices
  for each row execute function public.sync_competitor_price_organization_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.competitors enable row level security;

create policy "members can view their organization's competitors"
  on public.competitors for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can manage competitors"
  on public.competitors for all
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

alter table public.competitor_prices enable row level security;

create policy "members can view their organization's competitor prices"
  on public.competitor_prices for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can log competitor prices"
  on public.competitor_prices for insert
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can correct competitor prices"
  on public.competitor_prices for update
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));
