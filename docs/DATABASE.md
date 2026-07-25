# Datenbank & Migrationen — Ist-Zustand

> Zuletzt verifiziert: 25. Juli 2026 (direkte Inspektion der Live-DB via SSH → `docker exec supabase-db psql`)

## Kernaussage: `supabase/migrations/` ist NICHT die Quelle der Wahrheit

Dieses Projekt hat **nie** `supabase_migrations.schema_migrations` (die Tracking-Tabelle der Supabase-CLI) genutzt — sie existiert in der Live-DB schlicht nicht. Es gibt also keinen Mechanismus, der protokolliert, welche Datei in `supabase/migrations/` tatsächlich angewendet wurde.

Bestätigt am 5. August 2026 durch direkten Vergleich von `pg_policies` (Live-DB) gegen die 22 Migrationsdateien, die RLS-Policies für Kerntabellen definieren:

- Mehrere Policy-Generationen existieren **gleichzeitig** auf denselben Tabellen unter unterschiedlichen Namen (z. B. `clubs_select` UND `clubs_owner_select` UND `clubs_select_admin` — alle drei aktiv, Postgres verknüpft sie mit OR). Jede neue Migration, die eine Policy unter einem NEUEN Namen anlegt statt eine bestehende per `DROP POLICY <alterName>` zu ersetzen, häuft sich so unbemerkt an.
- `20260731_fix_security_advisor_findings.sql` dokumentiert selbst, dass zum Zeitpunkt seiner Erstellung "~40 Tage" lokaler Migrationen (`20260620` bis `20260730`) laut `supabase migration list` **nie** auf die Live-DB gepusht wurden.
- Mindestens eine Tabelle (`club_members`) existiert in der Live-DB, obwohl **keine** Migrationsdatei sie anlegt — vermutlich per Hand über den Supabase-Dashboard-SQL-Editor erstellt. Sie hat **0 Zeilen** (vs. 442 in `user_club_memberships`) und keinen Sync-Trigger — jede Policy, die sie referenziert, ist für alle Nicht-Superadmins faktisch tot.
- Umgekehrt: mehrere spätere Migrationsdateien (z. B. `20260625000000_fix_rls_club_members_references.sql`) wurden **nie angewendet** — ihre "Fixes" existieren nur als Datei, nicht in der Live-DB.

**Konsequenz für jede künftige Änderung an RLS-Policies, Funktionen oder Tabellen:** Vor dem Schreiben einer Migration IMMER den Live-Zustand direkt prüfen (siehe unten), nicht von den Migrationsdateien auf den Ist-Zustand schließen.

## Wie man den echten Live-Zustand prüft

VPS-Zugriff und SSH-Setup: siehe Git-/Infra-Memory (SSH-Key `~/.ssh/manitu_vps`, passphrasegeschützt, Host `deploy@178.254.37.110`).

```bash
# Alle Policies + USING/WITH CHECK-Klauseln für eine Tabelle
docker exec supabase-db psql -U postgres -c "select policyname, cmd, qual, with_check from pg_policies where tablename = '<table>';"

# Existiert eine Funktion wirklich (nicht nur in einer Migrationsdatei referenziert)?
docker exec supabase-db psql -U postgres -c "select proname from pg_proc where proname = '<function>';"

# Ist eine Tabelle echt befüllt oder totes Gerüst?
docker exec supabase-db psql -U postgres -c "select count(*) from <table>;"
```

## Rollen-/Club-Scoping-Modell (aktueller, korrekter Stand)

- `user_club_memberships` ist die EINZIGE verlässliche Mitgliedschafts-Tabelle (442 Zeilen, Stand 05.08.2026). `club_members` (0 Zeilen) ist tot — nie in Policies oder App-Code referenzieren, sollte langfristig per Migration gedroppt werden (nicht in diesem Zug gemacht, um destruktive Änderungen von diesem Refactor zu trennen).
- **owner**: keine `club_id`-gebundene Mitgliedschaft, sieht/verwaltet alle Vereine (`is_owner()`).
- **superadmin**: pro verwaltetem Verein eine eigene `user_club_memberships`-Zeile mit `role='superadmin'` — genau wie ein Admin, nur mehrfach. Zwei Wege, wie diese Zeilen entstehen: (1) Owner weist über `/owner/superadmins` einen bestehenden Verein zu, (2) Superadmin legt selbst einen neuen Verein an (`POST /api/clubs`) — beide Wege erzeugen jetzt konsistent `role='superadmin'`-Zeilen (App-Fix vom 05.08.2026, vorher erzeugte Pfad 2 fälschlich `role='admin'`).
- **Scoping-Helper** (SECURITY DEFINER SQL-Funktionen, alle bestätigt live vorhanden): `is_club_admin(club_id)`, `is_club_trainer(club_id)`, `is_club_member(club_id)` — alle drei prüfen `user_club_memberships` mit echtem `club_id`-Bezug und schließen `superadmin` in ihrer Rollen-Liste ein. `is_superadmin_of(club_id)` (neu, 05.08.2026) ist der Ersatz für den alten `is_superadmin()`-Bypass, wo keine der drei anderen Funktionen passt.
- **`is_superadmin()`** (ohne Club-Parameter) prüft NUR "hat dieser User irgendwo eine `role='superadmin'`-Zeile" — **niemals club-scoped verwenden**. Wurde bis 05.08.2026 in ~23 Policies über 20 Tabellen unscoped eingesetzt (siehe `supabase/migrations/20260805000000_scope_superadmin_to_managed_clubs.sql` für die vollständige Historie der gefixten Policies).

## Gelöste Altlasten (Stand 05.08.2026, zweiter Fix-Durchgang)

- **`get_user_role()`** — komplett gedroppt (`20260805010000_drop_dead_club_members_and_get_user_role.sql`). Live bestätigt: `public.users` hat gar keine `role`-Spalte, die Funktion wäre bei Aufruf fehlgeschlagen. Keine Policy referenzierte sie mehr zum Zeitpunkt des Drops.
- **`club_members`** — komplett gedroppt (Tabelle + Drizzle-Schema-Export `clubMemberships`). War kein reines Doku-Problem: `src/infrastructure/persistence/repositories/member.repository.ts` (`DrizzleMemberRepository.findByClub()`/`.save()`, verdrahtet über `container.ts` in echte Use-Cases: `get-club-members`, Buchungen, Reminder-Mails) las/schrieb aktiv gegen diese leere Tabelle — Mitgliederlisten waren dadurch leer, neu angelegte Mitgliedschaften landeten nirgends, wo sie sonst gelesen werden. Auf `user_club_memberships` umgestellt. Zusätzlich hingen an `club_members` noch vier `trial_trainings`-Admin-Policies (create/delete/update/view — Admins hatten dort faktisch KEINEN funktionierenden Zugriff) und zwei `season_group_weeks`-Policies (admin_all, member_read) — alle auf `is_club_admin`/`is_club_member` umgestellt. Backup-Script (`app/api/cron/backup/route.ts`) und ein Integrationstest-Cleanup wurden ebenfalls bereinigt.

## Bewusst zurückgestellt (siehe `docs/tickets/`)

- **`billing_periods` / `trainer_billings` / `billing_line_items`**: kein `club_id` in der Tabelle erreichbar — vermutlich ein plattformweites Konzept, nicht pro Verein. `trainer_billings`/`billing_line_items` vergleichen zudem `trainer_id` direkt mit `auth.uid()` (derselbe Bug, der für `hours_logs`/`attendance_records`/`trainer_availabilities` bereits gefixt wurde). Ticket: `docs/tickets/TICKET-billing-tables-rls-scoping.md`.
- **`background_jobs`**: `club_id` steckt nur optional in einem JSONB-Payload-Feld, nicht jeder Job ist vereinsbezogen — bewusst unscoped gelassen, kein Ticket nötig.

## Dateihygiene `supabase/migrations/` (Stand 25.07.2026)

Vollständiger Ordner-Check: 156 Migrationsdateien, alle bis auf zwei folgen dem `YYYYMMDD[HHMMSS]_name.sql`-Schema.

- Die 5 jüngsten Migrationen (`20260804000000` bis `20260805010000`, siehe oben) lagen nach der letzten Session nur lokal vor (`git status` zeigte `??`) — jetzt committet. Live-Check per `docker exec supabase-db psql` bestätigt: `get_user_role`/`club_members` existieren nicht mehr, `is_superadmin_of` existiert — Dateien und Live-DB stimmen überein.
- `fix_booking_rpc_and_overlap.sql` (kein Zeitstempel-Präfix) → umbenannt zu `20260505030000_fix_booking_rpc_and_overlap.sql`. Live-Check bestätigt: die `create_booking_safe`-Signatur in der DB entspricht exakt dieser Datei (kein späteres Migration überschreibt sie) — reine Umbenennung, keine erneute Anwendung nötig.
- `TEMPLATE_person_user_split.sql` (im eigenen Header als "NOT APPLIED" markiert, Referenz auf das archivierte `docs/ARCHIV/INTEGRATION_ROADMAP.md`) → verschoben nach `docs/ARCHIV/`, da `supabase/migrations/` nur echte Historie enthalten soll.
- `supabase_migrations.schema_migrations` existiert weiterhin nicht live (bestätigt) — die Kernaussage oben bleibt unverändert gültig.

## Prozess-Regel für künftige Migrationen

Siehe `AGENTS.md` → Abschnitt "Migrationen" für die verbindliche Regel (Live-Zustand vor Schreiben prüfen, exakte Policy-Namen aus `pg_policies` übernehmen statt aus alten Migrationsdateien zu raten, diese Datei bei jeder Policy-relevanten Änderung aktualisieren).
