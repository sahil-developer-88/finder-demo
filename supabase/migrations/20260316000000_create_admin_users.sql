-- Admin users table — grants admin access to specific user IDs.
-- Only a Supabase service-role call or direct DB access can insert rows here.
-- The frontend useHasRole hook reads this table to verify admin status
-- instead of relying on user-controlled email patterns or user_metadata.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);

-- Only admins (service role) can read/write this table
alter table public.admin_users enable row level security;

-- Admins can see their own row (so the client query works)
create policy "Users can read their own admin row"
  on public.admin_users
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete from client — must use service role
