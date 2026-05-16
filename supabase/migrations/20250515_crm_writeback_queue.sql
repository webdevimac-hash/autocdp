-- CRM write-back retry queue
-- Stores failed (and pending) CRM write-back attempts so they can be
-- retried with exponential back-off without losing campaign data silently.

create table if not exists crm_writeback_queue (
  id                 uuid        primary key default gen_random_uuid(),
  dealership_id      uuid        not null,
  customer_id        uuid        not null,
  provider           text        not null check (provider in ('vinsolutions','dealertrack','elead')),
  native_id          text        not null,          -- CRM-side record ID
  event_type         text        not null,          -- WritebackEvent value
  activity_payload   jsonb       not null,          -- full args passed to adapter
  status             text        not null default 'pending'
                                check (status in ('pending','processing','succeeded','dead')),
  attempts           integer     not null default 0,
  max_attempts       integer     not null default 5,
  last_error         text,
  last_attempted_at  timestamptz,
  next_retry_at      timestamptz not null default now(),
  succeeded_at       timestamptz,
  created_at         timestamptz not null default now()
);

-- Index for the cron worker: claim pending rows ordered by next_retry_at
create index if not exists crm_writeback_queue_pending_idx
  on crm_writeback_queue (next_retry_at asc)
  where status = 'pending';

-- Index for the integrations UI: count dead rows per dealership
create index if not exists crm_writeback_queue_dead_idx
  on crm_writeback_queue (dealership_id, status)
  where status = 'dead';

-- RLS: service role bypasses; auth users can only read their own dealership's rows
alter table crm_writeback_queue enable row level security;

create policy "users can view their dealership queue"
  on crm_writeback_queue
  for select
  using (
    dealership_id in (
      select dealership_id from user_dealerships where user_id = auth.uid()
    )
  );
