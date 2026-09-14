-- Sprint 5 — cleaning tasks, checklists, and issue reports (spec sections
-- 19-26). The centerpiece is the trigger at the bottom: a cleaning task is
-- generated automatically the moment a reservation exists with a checkout
-- date, regardless of whether that reservation was entered manually or
-- imported from an iCal feed — both paths go through the same `reservations`
-- table, so one trigger covers both.

create type public.cleaning_task_status as enum (
  'unassigned', 'proposed', 'accepted', 'in_progress', 'done', 'needs_inspection', 'problem', 'cancelled'
);

create type public.cleaning_task_type as enum (
  'standard', 'deep', 'post_long_stay', 'linen_change', 'quality_check', 'maintenance', 'restock', 'inspection'
);

-- ---------------------------------------------------------------------------
-- cleaning_checklists — one editable checklist per unit (spec section 24).
-- ---------------------------------------------------------------------------
create table public.cleaning_checklists (
  unit_id uuid primary key references public.units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  items text[] not null default array[
    'Literie', 'Serviettes', 'Salle de bain', 'Cuisine', 'Sol', 'Poubelles', 'Produits', 'Wi-Fi'
  ],
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.cleaning_checklists
  for each row execute function public.set_updated_at();

create or replace function public.sync_checklist_organization_id()
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
  before insert or update of unit_id on public.cleaning_checklists
  for each row execute function public.sync_checklist_organization_id();

-- ---------------------------------------------------------------------------
-- cleaning_tasks
-- ---------------------------------------------------------------------------
create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  scheduled_date date not null,
  task_type public.cleaning_task_type not null default 'standard',
  status public.cleaning_task_status not null default 'unassigned',
  assigned_to uuid references auth.users(id) on delete set null,
  priority smallint not null default 0,
  notes text,
  checklist_results jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index cleaning_tasks_org_date_idx on public.cleaning_tasks(organization_id, scheduled_date);
create index cleaning_tasks_assigned_idx on public.cleaning_tasks(assigned_to, scheduled_date);
create index cleaning_tasks_reservation_idx on public.cleaning_tasks(reservation_id);

create trigger set_updated_at
  before update on public.cleaning_tasks
  for each row execute function public.set_updated_at();

create or replace function public.sync_cleaning_task_organization_id()
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
  before insert or update of unit_id on public.cleaning_tasks
  for each row execute function public.sync_cleaning_task_organization_id();

-- ---------------------------------------------------------------------------
-- cleaning_issues — "signaler un problème" (spec section 23/26): a broken
-- item, something missing, any anomaly. Feeds a future maintenance module;
-- for now it's the record of what was reported and by whom.
-- ---------------------------------------------------------------------------
create table public.cleaning_issues (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.cleaning_tasks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  description text not null check (char_length(trim(description)) > 0),
  photo_storage_path text,
  reported_by uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index cleaning_issues_task_id_idx on public.cleaning_issues(task_id);
create index cleaning_issues_org_status_idx on public.cleaning_issues(organization_id, status);

create or replace function public.sync_issue_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id from public.cleaning_tasks where id = new.task_id;
  if new.organization_id is null then
    raise exception 'cleaning task % does not exist', new.task_id;
  end if;
  return new;
end;
$$;

create trigger sync_organization_id
  before insert on public.cleaning_issues
  for each row execute function public.sync_issue_organization_id();

-- ---------------------------------------------------------------------------
-- Automation: WHEN a reservation exists (any status but cancelled) THEN
-- ensure a cleaning task exists for its checkout date. WHEN a reservation
-- is cancelled THEN cancel the task it generated, unless work on it has
-- already started (left for a human to sort out rather than silently
-- vanishing from under a cleaner mid-shift).
-- ---------------------------------------------------------------------------
create or replace function public.sync_cleaning_task_for_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    update public.cleaning_tasks
    set status = 'cancelled'
    where reservation_id = new.id
      and status in ('unassigned', 'proposed', 'accepted');
    return new;
  end if;

  if not exists (select 1 from public.cleaning_tasks where reservation_id = new.id) then
    insert into public.cleaning_tasks (unit_id, reservation_id, scheduled_date, task_type)
    values (new.unit_id, new.id, new.check_out, 'standard');
  elsif (tg_op = 'UPDATE' and old.check_out is distinct from new.check_out) then
    update public.cleaning_tasks
    set scheduled_date = new.check_out
    where reservation_id = new.id
      and status in ('unassigned', 'proposed', 'accepted');
  end if;

  return new;
end;
$$;

create trigger sync_cleaning_task
  after insert or update of status, check_out on public.reservations
  for each row execute function public.sync_cleaning_task_for_reservation();

-- ---------------------------------------------------------------------------
-- Storage — cleaning issue photos. Any org member can upload (cleaners are
-- the ones filing reports, unlike unit photos which are admin/manager-only).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cleaning-photos', 'cleaning-photos', true)
on conflict (id) do nothing;

create policy "org members can list cleaning photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cleaning-photos' and public.is_org_member((storage.foldername(name))[1]::uuid));

create policy "org members can upload cleaning photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cleaning-photos' and public.is_org_member((storage.foldername(name))[1]::uuid));

-- ---------------------------------------------------------------------------
-- RLS — cleaning_checklists (managed by admins/managers)
-- ---------------------------------------------------------------------------
alter table public.cleaning_checklists enable row level security;

create policy "members can view their organization's checklists"
  on public.cleaning_checklists for select
  using (public.is_org_member(organization_id));

create policy "admins and managers can manage checklists"
  on public.cleaning_checklists for all
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- RLS — cleaning_tasks
-- A cleaner sees and updates only tasks assigned to them; admins/managers
-- see and manage every task in the organization. No delete policy —
-- cancelled tasks stay for the record, same reasoning as reservations.
-- ---------------------------------------------------------------------------
alter table public.cleaning_tasks enable row level security;

create policy "admins/managers see all tasks, cleaners see their own"
  on public.cleaning_tasks for select
  using (
    public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[])
    or assigned_to = auth.uid()
  );

create policy "admins and managers can create tasks"
  on public.cleaning_tasks for insert
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins/managers manage all tasks, cleaners update their own"
  on public.cleaning_tasks for update
  using (
    public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[])
    or assigned_to = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS — cleaning_issues
-- ---------------------------------------------------------------------------
alter table public.cleaning_issues enable row level security;

create policy "admins/managers see all issues, reporters see their own"
  on public.cleaning_issues for select
  using (
    public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[])
    or reported_by = auth.uid()
  );

create policy "assigned cleaners and managers can report issues"
  on public.cleaning_issues for insert
  with check (
    public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[])
    or exists (
      select 1 from public.cleaning_tasks t
      where t.id = task_id and t.assigned_to = auth.uid()
    )
  );

create policy "admins and managers can resolve issues"
  on public.cleaning_issues for update
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- Backfill: the trigger above only fires on new inserts/updates, so
-- reservations created before this migration (your Sprint 3/4 test data)
-- wouldn't otherwise get a cleaning task. Catch them up once, here.
-- ---------------------------------------------------------------------------
insert into public.cleaning_tasks (unit_id, reservation_id, scheduled_date)
select r.unit_id, r.id, r.check_out
from public.reservations r
where r.status <> 'cancelled'
  and not exists (select 1 from public.cleaning_tasks t where t.reservation_id = r.id);
