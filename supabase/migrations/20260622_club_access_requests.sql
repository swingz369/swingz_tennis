create table if not exists club_access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club_name text,
  email text not null,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table club_access_requests enable row level security;

create policy "owner can read access requests"
  on club_access_requests for select
  using (true);
