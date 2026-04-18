-- ============================================================
-- 008_integrations.sql — DMS connection tracking
-- ============================================================

-- Stores OAuth tokens / API keys for each DMS provider per dealership.
-- Tokens are stored AES-256-GCM encrypted at the application layer.
create table if not exists dms_connections (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  provider      text not null,            -- 'cdk_fortellis' | 'reynolds'
  status        text not null default 'pending', -- 'pending' | 'active' | 'error' | 'disconnected'
  -- encrypted token blob (JSON: {accessToken, refreshToken, expiresAt, ...})
  encrypted_tokens text,
  -- Reynolds: plain API key stored encrypted in same field
  last_sync_at  timestamptz,
  last_error    text,
  metadata      jsonb default '{}'::jsonb, -- dealer_id, subscription_id, etc.
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(dealership_id, provider)
);

-- Tracks each sync run (full or delta)
create table if not exists sync_jobs (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  connection_id uuid not null references dms_connections(id) on delete cascade,
  provider      text not null,
  job_type      text not null default 'delta', -- 'full' | 'delta'
  status        text not null default 'running', -- 'running' | 'completed' | 'failed'
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  records_synced jsonb default '{"customers":0,"visits":0,"inventory":0}'::jsonb,
  error         text,
  cursor        text  -- last processed cursor/timestamp for delta syncs
);

-- Detailed log lines per sync job
create table if not exists sync_logs (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references sync_jobs(id) on delete cascade,
  level      text not null default 'info', -- 'info' | 'warn' | 'error'
  message    text not null,
  data       jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table dms_connections enable row level security;
alter table sync_jobs       enable row level security;
alter table sync_logs       enable row level security;

-- dms_connections: dealership can see/edit their own
create policy "dms_connections_dealership" on dms_connections
  using (dealership_id = auth_dealership_id())
  with check (dealership_id = auth_dealership_id());

-- sync_jobs
create policy "sync_jobs_dealership" on sync_jobs
  using (dealership_id = auth_dealership_id());

-- sync_logs: visible if you can see the job
create policy "sync_logs_dealership" on sync_logs
  using (
    job_id in (
      select id from sync_jobs where dealership_id = auth_dealership_id()
    )
  );

-- indexes
create index if not exists dms_connections_dealership_idx on dms_connections(dealership_id);
create index if not exists sync_jobs_dealership_idx on sync_jobs(dealership_id);
create index if not exists sync_jobs_connection_idx on sync_jobs(connection_id);
create index if not exists sync_logs_job_idx on sync_logs(job_id);
