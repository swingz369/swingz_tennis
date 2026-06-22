-- Ehrenmitglieder
alter table user_club_memberships
  add column if not exists is_honorary boolean not null default false,
  add column if not exists honorary_since date;

-- Vereinsregister (legal info stored as JSONB on clubs)
alter table clubs
  add column if not exists legal_info jsonb not null default '{}';

-- Dokumentenverwaltung
create table if not exists club_documents (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  category text not null default 'sonstige',
  file_url text not null,
  file_path text not null,
  file_size_bytes bigint,
  mime_type text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table club_documents enable row level security;

create policy "club members can read documents"
  on club_documents for select
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = club_documents.club_id
        and is_active = true
    )
  );

create policy "admins can manage documents"
  on club_documents for all
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = club_documents.club_id
        and role in ('admin', 'superadmin', 'owner')
        and is_active = true
    )
  );

-- Wartungsplan
create table if not exists court_maintenance (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  court_id uuid references courts(id) on delete set null,
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  status text not null default 'geplant',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table court_maintenance enable row level security;

create policy "club members can read maintenance"
  on court_maintenance for select
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = court_maintenance.club_id
        and is_active = true
    )
  );

create policy "admins can manage maintenance"
  on court_maintenance for all
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = court_maintenance.club_id
        and role in ('admin', 'superadmin', 'owner')
        and is_active = true
    )
  );

-- Mitgliederversammlung
create table if not exists member_meetings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  title text not null,
  meeting_date timestamptz not null,
  location text,
  description text,
  status text not null default 'geplant',
  agenda jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table member_meetings enable row level security;

create policy "club members can read meetings"
  on member_meetings for select
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = member_meetings.club_id
        and is_active = true
    )
  );

create policy "admins can manage meetings"
  on member_meetings for all
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = member_meetings.club_id
        and role in ('admin', 'superadmin', 'owner')
        and is_active = true
    )
  );
