-- Fire the `notify-on-event` Edge Function whenever a new order or request
-- is inserted. Requires the `pg_net` extension (Supabase enables this by
-- default in new projects; run `create extension if not exists pg_net;` if
-- it isn't already there).
--
-- The Edge Function URL and invoke key are inlined here. Both are public:
-- the URL is the well-known Supabase project URL and the key is the
-- publishable (anon) key that ships in every browser bundle. Inlining
-- avoids relying on database-level GUCs which Supabase's connection role
-- isn't permitted to set. The Web Push private key — the only real secret
-- in this pipeline — is set in Supabase secrets and read inside the
-- Edge Function, never seen by Postgres.

create or replace function public.notify_on_order_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url constant text :=
    'https://znwuibfsjhmelgsdrsju.supabase.co/functions/v1';
  edge_key constant text :=
    'sb_publishable_gHNgCqlnMal2SQl_672jfw_U2mrmmO8';
begin
  perform net.http_post(
    url      := edge_url || '/notify-on-event',
    headers  := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ' || edge_key
                ),
    body     := jsonb_build_object(
                  'type', 'order',
                  'record', to_jsonb(new)
                ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create or replace function public.notify_on_request_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url constant text :=
    'https://znwuibfsjhmelgsdrsju.supabase.co/functions/v1';
  edge_key constant text :=
    'sb_publishable_gHNgCqlnMal2SQl_672jfw_U2mrmmO8';
begin
  perform net.http_post(
    url      := edge_url || '/notify-on-event',
    headers  := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ' || edge_key
                ),
    body     := jsonb_build_object(
                  'type', 'request',
                  'record', to_jsonb(new)
                ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists on_order_insert_notify on public.orders;
create trigger on_order_insert_notify
  after insert on public.orders
  for each row execute function public.notify_on_order_insert();

drop trigger if exists on_request_insert_notify on public.requests;
create trigger on_request_insert_notify
  after insert on public.requests
  for each row execute function public.notify_on_request_insert();

-- Supabase Realtime: ensure the tables we subscribe to from the dashboard
-- are in the publication. ALTER PUBLICATION ADD TABLE errors on duplicates,
-- so we guard each one against pg_publication_tables to keep this idempotent.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='requests'
  ) then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;
