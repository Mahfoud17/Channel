-- Sprint 7-8 — dynamic pricing (spec sections 9, 12-15, 18). Manual mode
-- only: this engine recommends, it never writes a price anywhere by
-- itself. Auto-apply is a deliberate later step once the recommendations
-- have been trusted for a while — see spec section 18's own two-mode split.

-- ---------------------------------------------------------------------------
-- Base rate fields on units — closes the MVP gap where price could only be
-- entered per-reservation, never set as a starting point for a logement.
-- ---------------------------------------------------------------------------
alter table public.units
  add column base_price numeric(10, 2),
  add column min_price numeric(10, 2),
  add column max_price numeric(10, 2);

alter table public.units
  add constraint units_price_bounds_valid
  check (
    (min_price is null or min_price >= 0)
    and (max_price is null or max_price >= 0)
    and (min_price is null or max_price is null or min_price <= max_price)
  );

-- ---------------------------------------------------------------------------
-- pricing_rules — a small set of well-defined rule kinds rather than a
-- free-form expression language: easier to compute, test, and explain to a
-- non-technical gestionnaire than an open-ended DSL would be.
--
--   weekend             — adjustment applied to Friday/Saturday nights
--   occupancy_high      — adjustment when occupancy over `lookahead_days`
--                          is ABOVE `occupancy_threshold_pct`
--   occupancy_low       — same, but BELOW the threshold (demand is soft)
--   length_of_stay      — adjustment when the candidate stay is between
--                          min_nights and max_nights (max_nights null = open-ended)
--   last_minute         — adjustment when check-in is within
--                          days_before_checkin_max days from today
--
-- Rules apply as sequential adjustments to a running price, in `priority`
-- order (lower first) — matches the cahier des charges' own worked example
-- (+10%, then +20%, then +25%, applied one after another, not averaged).
-- ---------------------------------------------------------------------------
create type public.pricing_rule_type as enum (
  'weekend', 'occupancy_high', 'occupancy_low', 'length_of_stay', 'last_minute'
);

create type public.pricing_adjustment_type as enum ('percent', 'fixed');

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- null = applies to every unit in the organization that doesn't have a
  -- more specific rule of the same type; set = overrides for one unit only.
  unit_id uuid references public.units(id) on delete cascade,
  rule_type public.pricing_rule_type not null,
  label text not null,
  lookahead_days integer,
  occupancy_threshold_pct integer,
  min_nights integer,
  max_nights integer,
  days_before_checkin_max integer,
  adjustment_type public.pricing_adjustment_type not null default 'percent',
  adjustment_value numeric(10, 2) not null,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pricing_rules_org_idx on public.pricing_rules(organization_id);
create index pricing_rules_unit_idx on public.pricing_rules(unit_id);

create trigger set_updated_at
  before update on public.pricing_rules
  for each row execute function public.set_updated_at();

create or replace function public.sync_pricing_rule_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_id is not null then
    select organization_id into new.organization_id from public.units where id = new.unit_id;
    if new.organization_id is null then
      raise exception 'unit % does not exist', new.unit_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger sync_organization_id
  before insert or update of unit_id on public.pricing_rules
  for each row execute function public.sync_pricing_rule_organization_id();

alter table public.pricing_rules enable row level security;

create policy "members can view their organization's pricing rules"
  on public.pricing_rules for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can manage pricing rules"
  on public.pricing_rules for all
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));
