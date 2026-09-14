-- Sprint 1 — extensions required by later migrations.
-- pgcrypto: gen_random_uuid() for primary keys.
-- btree_gist: needed by the exclusion constraint on reservations (Sprint 3)
--             that prevents double-booking at the database level.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
