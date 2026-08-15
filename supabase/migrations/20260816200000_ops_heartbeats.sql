-- Lebenszeichen von Vorgängen, die außerhalb der App laufen — zunächst das
-- nächtliche Backup auf dem VPS.
--
-- Grund: Ein Backup, das aufhört zu laufen, sieht von außen aus wie eines, das
-- läuft. Erst ein Zeitstempel, der altert, macht den Stillstand sichtbar.
-- /api/health liest die Tabelle und meldet das Backup als veraltet, sobald es
-- älter als 36 Stunden ist (ein ausgefallener Lauf ist noch kein Alarm, zwei
-- schon). Siehe docs/SERVICES.md.

create table if not exists public.ops_heartbeats (
  name         text primary key,
  last_seen_at timestamptz not null default now(),
  detail       jsonb
);

comment on table public.ops_heartbeats is
  'Zeitstempel externer Jobs (VPS-Backup u. a.). Geschrieben von Skripten ausserhalb der App, gelesen von /api/health.';

alter table public.ops_heartbeats enable row level security;
alter table public.ops_heartbeats force row level security;

-- Bewusst ohne Policy: Es schreibt der Server (Superuser), es liest der
-- Service-Client — beide umgehen RLS ohnehin. Für jede andere Rolle bleibt die
-- Tabelle damit leer, was hier die gewünschte Antwort ist.
