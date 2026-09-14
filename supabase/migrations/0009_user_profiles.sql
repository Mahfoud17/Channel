-- Sprint 5 prerequisite — a public.profiles table mirroring auth.users.
-- Supabase's internal auth.users table isn't readable through the normal
-- API even by other members of the same organization (by design), so
-- there's been no way to show "who is this user" anywhere in the UI —
-- unnoticed until now because nothing needed to render another member's
-- name yet. Assigning a cleaning task to a cleaner is the first feature
-- that does.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new signup gets a profile row automatically, kept in sync with
-- auth.users by Supabase itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: accounts created before this migration (yours) don't have a
-- profile yet — catch them up once, here.
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------------
-- RLS — a profile is visible to yourself and to anyone who shares at least
-- one organization with you (needed to show "assigned to Marie" anywhere).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "co-members can view each other's profile"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

create policy "users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());
