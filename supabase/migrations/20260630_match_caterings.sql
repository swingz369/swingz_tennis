-- F4.3: Bewirtungs-Planung für Heimspiele
-- Jeder match_day bekommt maximal einen Catering-Eintrag (UNIQUE auf match_day_id).

create type catering_status as enum ('not_planned', 'planned', 'ready');

create table match_caterings (
  id              uuid          primary key default gen_random_uuid(),
  match_day_id    uuid          not null references match_days(id) on delete cascade,
  club_id         uuid          not null references clubs(id) on delete cascade,
  status          catering_status not null default 'not_planned',
  organizer_name  text,
  expected_guests integer       check (expected_guests >= 0),
  notes           text,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  unique (match_day_id)
);

alter table match_caterings enable row level security;

-- Admins/Superadmins dürfen alles
create policy "admin manage match_caterings"
  on match_caterings
  for all
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = match_caterings.club_id
        and role in ('admin', 'superadmin', 'owner')
        and is_active = true
    )
  );

-- Mitglieder dürfen lesen
create policy "member read match_caterings"
  on match_caterings
  for select
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = match_caterings.club_id
        and is_active = true
    )
  );
