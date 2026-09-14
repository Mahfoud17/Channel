-- Sprint 10 — message templates and scheduled messages (spec section 27).
-- No email/SMS/WhatsApp provider is connected, so this deliberately stops
-- short of sending anything: the trigger below generates the right message,
-- pre-rendered with the right variables, at the right time — an admin then
-- copies it out and sends it through whatever channel they actually use
-- today, and marks it sent. Wiring a real provider later (Resend, Twilio…)
-- only replaces the "mark as sent" click with an actual API call; nothing
-- about this schema changes.

create type public.message_trigger_type as enum (
  'on_created', 'before_checkin', 'after_checkin', 'before_checkout', 'after_checkout'
);

create type public.scheduled_message_status as enum ('pending', 'sent', 'cancelled');

-- ---------------------------------------------------------------------------
-- message_templates
-- ---------------------------------------------------------------------------
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  trigger_type public.message_trigger_type not null,
  -- days before/after check-in or check-out, depending on trigger_type;
  -- meaningless (and ignored) for 'on_created'.
  offset_days integer not null default 0,
  channel text not null default 'email' check (channel in ('email')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_templates_org_idx on public.message_templates(organization_id);

create trigger set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

alter table public.message_templates enable row level security;

create policy "admins and managers can view their organization's templates"
  on public.message_templates for select
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can manage templates"
  on public.message_templates for all
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- scheduled_messages — the queue. Rendered once at generation time (not
-- re-rendered at send time), so it reflects the logement's details as they
-- were when the reservation was made — editing wifi_password afterwards
-- doesn't retroactively rewrite a message already queued to go out.
-- ---------------------------------------------------------------------------
create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  template_id uuid references public.message_templates(id) on delete set null,
  recipient_name text,
  recipient_email text,
  subject text,
  body text not null,
  send_at timestamptz not null,
  status public.scheduled_message_status not null default 'pending',
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index scheduled_messages_org_send_at_idx on public.scheduled_messages(organization_id, send_at);
create index scheduled_messages_reservation_idx on public.scheduled_messages(reservation_id);

alter table public.scheduled_messages enable row level security;

create policy "admins and managers can view their organization's message queue"
  on public.scheduled_messages for select
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

create policy "admins and managers can update queued messages"
  on public.scheduled_messages for update
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- Variable rendering, shared by subject and body so both stay in sync.
-- Matches spec section 27's variable set, plus {{nom}} (last name) which
-- the spec's example omits but which is trivially available and often
-- wanted alongside {{prenom}}.
-- ---------------------------------------------------------------------------
create or replace function public.render_message_variables(
  input text,
  p_first_name text,
  p_last_name text,
  p_unit_name text,
  p_check_in date,
  p_check_out date,
  p_access_code text,
  p_address text,
  p_wifi text
) returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(
    coalesce(input, ''),
    '{{prenom}}', coalesce(p_first_name, '')),
    '{{nom}}', coalesce(p_last_name, '')),
    '{{nom_logement}}', coalesce(p_unit_name, '')),
    '{{date_arrivee}}', to_char(p_check_in, 'DD/MM/YYYY')),
    '{{date_depart}}', to_char(p_check_out, 'DD/MM/YYYY')),
    '{{code_acces}}', coalesce(nullif(p_access_code, ''), 'non renseigné')),
    '{{adresse}}', coalesce(nullif(p_address, ''), 'non renseignée')),
    '{{wifi}}', coalesce(nullif(p_wifi, ''), 'non renseigné')
  );
$$;

-- ---------------------------------------------------------------------------
-- WHEN a reservation is created THEN generate one scheduled message per
-- active template, timed relative to check-in/check-out.
-- WHEN a reservation is cancelled THEN cancel its still-pending messages.
-- ---------------------------------------------------------------------------
create or replace function public.generate_scheduled_messages_for_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tmpl record;
  unit_row record;
  property_row record;
  wifi_text text;
  address_text text;
  send_date date;
begin
  if tg_op = 'UPDATE' then
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      update public.scheduled_messages
      set status = 'cancelled'
      where reservation_id = new.id and status = 'pending';
    end if;
    return new;
  end if;

  if new.status = 'cancelled' then
    return new;
  end if;

  select name, wifi_ssid, wifi_password, keybox_code, property_id
    into unit_row
  from public.units where id = new.unit_id;

  select address_line1, city into property_row
  from public.properties where id = unit_row.property_id;

  wifi_text := case
    when unit_row.wifi_ssid is not null and unit_row.wifi_ssid <> ''
      then unit_row.wifi_ssid || case when unit_row.wifi_password is not null and unit_row.wifi_password <> ''
        then ' / ' || unit_row.wifi_password else '' end
    else null
  end;

  address_text := nullif(
    trim(both ', ' from coalesce(property_row.address_line1, '') ||
      case when property_row.city is not null then ', ' || property_row.city else '' end),
    ''
  );

  for tmpl in
    select * from public.message_templates
    where organization_id = new.organization_id and is_active
  loop
    send_date := case tmpl.trigger_type
      when 'on_created' then current_date
      when 'before_checkin' then new.check_in - tmpl.offset_days
      when 'after_checkin' then new.check_in + tmpl.offset_days
      when 'before_checkout' then new.check_out - tmpl.offset_days
      when 'after_checkout' then new.check_out + tmpl.offset_days
    end;

    insert into public.scheduled_messages (
      organization_id, reservation_id, unit_id, template_id,
      recipient_name, recipient_email, subject, body, send_at
    ) values (
      new.organization_id, new.id, new.unit_id, tmpl.id,
      trim(both ' ' from new.guest_first_name || ' ' || new.guest_last_name),
      new.guest_email,
      public.render_message_variables(
        tmpl.subject, new.guest_first_name, new.guest_last_name, unit_row.name,
        new.check_in, new.check_out, unit_row.keybox_code, address_text, wifi_text
      ),
      public.render_message_variables(
        tmpl.body, new.guest_first_name, new.guest_last_name, unit_row.name,
        new.check_in, new.check_out, unit_row.keybox_code, address_text, wifi_text
      ),
      send_date::timestamptz
    );
  end loop;

  return new;
end;
$$;

create trigger generate_scheduled_messages
  after insert or update of status on public.reservations
  for each row execute function public.generate_scheduled_messages_for_reservation();
