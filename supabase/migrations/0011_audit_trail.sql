-- Closes an MVP acceptance criterion I'd left half-built: audit_logs has
-- existed since migration 0003, but nothing ever wrote to it. This adds a
-- generic trigger that logs INSERT/UPDATE on the tables that actually
-- matter for an operational history — reservations (dates, price, status —
-- the exact example from spec section 38), unit status, and cleaning task
-- status. before/after are full JSONB snapshots so any field's change is
-- recoverable, not just the ones we thought to track individually.

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_org_id uuid;
  row_id uuid;
begin
  if tg_op = 'DELETE' then
    row_org_id := old.organization_id;
    row_id := old.id;
  else
    row_org_id := new.organization_id;
    row_id := new.id;
  end if;

  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, before, after, source)
  values (
    row_org_id,
    auth.uid(),
    tg_op,
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    -- auth.uid() is null when the write came from the service-role client
    -- (the iCal sync engine) rather than a logged-in user's request.
    case when auth.uid() is null then 'system' else 'app' end
  );

  return coalesce(new, old);
end;
$$;

create trigger log_audit_event
  after insert or update on public.reservations
  for each row execute function public.log_audit_event();

create trigger log_audit_event
  after update of status on public.units
  for each row execute function public.log_audit_event();

create trigger log_audit_event
  after update of status on public.cleaning_tasks
  for each row execute function public.log_audit_event();
