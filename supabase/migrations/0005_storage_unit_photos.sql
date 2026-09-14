-- Sprint 2 — storage bucket for unit photos.
-- Path convention enforced by the app: {organization_id}/{unit_id}/{filename}
-- — the policies below read the first path segment as the organization id,
-- so uploads and deletes stay scoped to the uploader's own organization.

insert into storage.buckets (id, name, public)
values ('unit-photos', 'unit-photos', true)
on conflict (id) do nothing;

-- Public bucket: anyone with a photo's URL can view it directly (no auth
-- round-trip needed to render a gallery) — same trade-off already made for
-- the iCal export URLs (unguessable path, not access-controlled). Revisit
-- with signed URLs if photos ever need to be private.

create policy "org members can list unit photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'unit-photos'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "admins and managers can upload unit photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'unit-photos'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'manager']::public.org_role[])
  );

create policy "admins and managers can delete unit photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'unit-photos'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'manager']::public.org_role[])
  );
