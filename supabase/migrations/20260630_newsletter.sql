-- 2.5.3: Newsletter-Wizard
-- Templates sind hardcodiert im Code (news / event / reminder).
-- Diese Migration speichert nur Kampagnen + Versandlogs.

create table newsletter_campaigns (
  id              uuid        primary key default gen_random_uuid(),
  club_id         uuid        not null references clubs(id) on delete cascade,
  actor_id        uuid        references users(id) on delete set null,
  template        text        not null,
  subject         text        not null,
  body_html       text        not null,
  recipient_count integer     not null default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table newsletter_send_logs (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references newsletter_campaigns(id) on delete cascade,
  recipient_email text        not null,
  status          text        not null default 'sent',
  error_message   text,
  sent_at         timestamptz not null default now()
);

alter table newsletter_campaigns enable row level security;
alter table newsletter_send_logs enable row level security;

create policy "admin manage newsletter_campaigns"
  on newsletter_campaigns for all
  using (
    exists (
      select 1 from user_club_memberships
      where user_id = auth.uid()
        and club_id = newsletter_campaigns.club_id
        and role in ('admin', 'superadmin', 'owner')
        and is_active = true
    )
  );

create policy "admin read newsletter_send_logs"
  on newsletter_send_logs for select
  using (
    exists (
      select 1 from newsletter_campaigns nc
      join user_club_memberships m on m.club_id = nc.club_id
      where nc.id = newsletter_send_logs.campaign_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'superadmin', 'owner')
        and m.is_active = true
    )
  );

create policy "service role insert newsletter_send_logs"
  on newsletter_send_logs for insert
  with check (true);
