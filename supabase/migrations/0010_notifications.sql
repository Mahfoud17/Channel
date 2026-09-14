-- Sprint 6 — notifications (spec section 36). System-generated only: there
-- is deliberately no INSERT policy for regular users, only SECURITY DEFINER
-- triggers (or the service-role sync engine) write rows here, the same
-- trust boundary already used for sync_logs and the org-id sync triggers.
--
-- user_id null = broadcast to every admin/manager of the organization;
-- user_id set = targeted at one specific person (not used yet in this
-- sprint, but the column exists for later — e.g. "your sync failed" going
-- only to the admin who configured that channel).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_org_created_idx on public.notifications(organization_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;

create policy "members can view notifications addressed to them"
  on public.notifications for select
  using (
    public.is_org_member(organization_id)
    and (
      (user_id is null and public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]))
      or user_id = auth.uid()
    )
  );

create policy "members can mark their visible notifications as read"
  on public.notifications for update
  using (
    public.is_org_member(organization_id)
    and (
      (user_id is null and public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]))
      or user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- WHEN a reservation is created THEN notify admins/managers.
-- WHEN a reservation is cancelled THEN notify admins/managers.
-- ---------------------------------------------------------------------------
create or replace function public.notify_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_name text;
  guest_name text;
begin
  select name into unit_name from public.units where id = new.unit_id;
  guest_name := new.guest_first_name || ' ' || new.guest_last_name;

  if tg_op = 'INSERT' and new.status <> 'cancelled' then
    insert into public.notifications (organization_id, type, title, body, link)
    values (
      new.organization_id,
      'reservation_created',
      'Nouvelle réservation',
      guest_name || ' — ' || coalesce(unit_name, '?') || ' du ' || new.check_in || ' au ' || new.check_out,
      '/reservations/' || new.id
    );
  elsif tg_op = 'UPDATE' and old.status <> 'cancelled' and new.status = 'cancelled' then
    insert into public.notifications (organization_id, type, title, body, link)
    values (
      new.organization_id,
      'reservation_cancelled',
      'Réservation annulée',
      guest_name || ' — ' || coalesce(unit_name, '?'),
      '/reservations/' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger notify_reservation_event
  after insert or update of status on public.reservations
  for each row execute function public.notify_reservation_event();

-- ---------------------------------------------------------------------------
-- WHEN a cleaning task is completed or a problem is reported THEN notify
-- admins/managers.
-- ---------------------------------------------------------------------------
create or replace function public.notify_cleaning_task_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_name text;
begin
  if old.status is distinct from new.status and new.status in ('done', 'problem') then
    select name into unit_name from public.units where id = new.unit_id;
    insert into public.notifications (organization_id, type, title, body, link)
    values (
      new.organization_id,
      case when new.status = 'done' then 'cleaning_done' else 'cleaning_problem' end,
      case when new.status = 'done' then 'Ménage terminé' else 'Problème signalé' end,
      coalesce(unit_name, '?'),
      '/cleaning'
    );
  end if;
  return new;
end;
$$;

create trigger notify_cleaning_task_event
  after update of status on public.cleaning_tasks
  for each row execute function public.notify_cleaning_task_event();
