# Datenbank & Migrationen — Ist-Zustand

> Zuletzt verifiziert: 13. August 2026 (direkter psql-Zugriff auf `supabase.swingz.cloud:6543`)

## Kernaussage: `supabase/migrations/` ist NICHT die Quelle der Wahrheit

`supabase_migrations.schema_migrations` (die Tracking-Tabelle der Supabase-CLI) wurde am 26.07.2026 erstmals angelegt (`CREATE SCHEMA`/`CREATE TABLE`, Standard-CLI-Schema: `version` PK, `statements`, `name`, `created_by`, `idempotency_key`) und per `scripts/bulk-track-only-migrations.sh --no-dry-run` befüllt — **aber nur mit 8 von 155 Dateien**. Das Script akzeptiert per `DATE_PREFIX_REGEX='^[0-9]{8}$'` ausschließlich Dateinamen im reinen `YYYYMMDD_`-Format; die 132 Dateien im `YYYYMMDDHHMMSS_`-Format (14-stelliger Zeitstempel) laufen als `SKIPPED-NON-DATE-FILENAME` durch, und die 15 Dateien mit Datum ≤ `20260628` (`TODAY_PREFIX`-Konstante im Script) wurden gar nicht erst als Kandidat enumeriert. Die Tabelle existiert also jetzt, ist aber **weiterhin kein verlässliches Abbild** davon, welche Datei tatsächlich live angewendet wurde — die Kernaussage unten bleibt in der Praxis gültig, nur die Begründung hat sich geändert (unvollständiges Tracking statt komplett fehlendem Tracking).

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

## `PUBLIC`-Policies eingeschränkt (Stand 11.08.2026)

Live-Audit von `pg_policies` am 11.08.2026 (alle 114 `public`-Tabellen) fand fünf Policies ohne `TO`-Klausel und mit `USING (true)`/`WITH CHECK (true)`. Ohne `TO` gilt eine Policy für `PUBLIC`, und `PUBLIC` schließt `anon` ein — also jeden, der den im Browser-Bundle stehenden `NEXT_PUBLIC_SUPABASE_ANON_KEY` hat. Gefixt in `20260811000000_tighten_public_rls_policies.sql`:

| Tabelle                | Alte Policy                                                                                                            | Effekt                                                                                                                   | Neu                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contact_requests`     | `contact_requests_service_read` (SELECT, `true`)                                                                       | Name/E-Mail/Nachricht aller Kontaktanfragen anonym lesbar — der Name suggeriert service_role, die Policy galt für PUBLIC | `contact_requests_owner_read`, `TO authenticated USING (is_owner() OR is_superadmin())`                                                                           |
| `contact_requests`     | `contact_requests_insert_public` (INSERT, `true`)                                                                      | Beliebig viele Zeilen direkt über `/rest/v1` einfügbar, vorbei am `checkRateLimit()` der API-Route                       | ersatzlos gedroppt (Schreibpfad nutzt Service-Client)                                                                                                             |
| `club_access_requests` | `owner can read access requests` (SELECT, `true`)                                                                      | Interessentendaten anonym lesbar                                                                                         | `club_access_requests_owner_read`, `TO authenticated USING (is_owner() OR is_superadmin())`                                                                       |
| `gamification_points`  | `Everyone can view …` (SELECT, `true`), `System can update …` (UPDATE, `true`), `System can upsert …` (INSERT, `true`) | Punktestände anonym les- **und schreibbar**                                                                              | SELECT `TO authenticated USING (true)` (Leaderboard in `app/api/gamification/route.ts` läuft über `withApiAuth`); die beiden „System"-Policies ersatzlos gedroppt |
| `players`              | `players_select_all` (SELECT, `true`, `TO authenticated`)                                                              | Jeder eingeloggte User sah alle Spieler/ELO-Werte vereinsübergreifend; kein Code-Pfad liest die Tabelle überhaupt        | ersatzlos gedroppt, `players_admin_manage` bleibt                                                                                                                 |

Verifiziert vor dem Drop: `service_role` und `postgres` haben `rolbypassrls = true`, `anon`/`authenticated`/`authenticator` nicht — die „System"-Policies wurden von keinem Code gebraucht, alle Schreibpfade laufen über `createServiceClient()`.

## Doppelte Policy-Generationen aufgelöst (Stand 12.08.2026, angewendet)

`20260812000000_consolidate_duplicate_rls_policies.sql` — angewendet und verifiziert. Von 11 (Tabelle, cmd)-Gruppen mit mehr als zwei PERMISSIVE Policies sind 4 übrig, und die sind legitim (Admin/Trainer/Mitglied als drei getrennte Zielgruppen auf `dunning_records`, `fee_configurations`, `trainer_absences`, `trainer_feedback`).

Entfernt wurden drei Fehlerklassen, keine pauschale Zusammenfassung:

- **Exakte Dubletten** aus zwei Generationen: `Users can view/update/insert own schedule preferences` neben `member_schedule_prefs_*_own`, `user_prefs_admin_view` neben `Admins can view all preferences in club`, `users_admin_club` neben `Members can view club members`, `season_plan_entries_admin_all` neben `Admins can manage plan entries of their club`, `Admins can manage seasons of their club` neben `seasons_manage_admin` (wortgleich mit `is_club_admin(club_id)`).
- **Tote Policies**: `Trainers can view session attendance` verglich `sessions.trainer_id` (FK auf `trainers`) mit `auth.uid()` (users) — konnte nie zutreffen. Ebenso der `'super_admin'`-Zweig (mit Unterstrich) in `Admins can view all feedback`; die Rolle heißt `superadmin`, Superadmins sahen Feedback ihres eigenen Vereins also nicht. Ersetzt durch `trainer_feedback_admin_select` auf `is_club_admin(club_id)`.
- **Unscoped `is_superadmin()`**: `users_superadmin` (SELECT) und `seasons_all_superadmin` (ALL) — derselbe Cross-Tenant-Bypass, den `20260805000000` beseitigen sollte, auf zwei Tabellen übersehen.
- **Lockerere Generation hebt strengere auf**: `member_schedule_prefs_admin_select` prüfte die Admin-Mitgliedschaft ohne `is_active` und machte die `is_active`-Prüfung der Parallel-Policy wirkungslos.
- **Draft-Leak**: `Users can view plan entries of their club` gab jedem aktiven Mitglied jeden `season_plan_entries`-Eintrag unabhängig vom `status` und hob damit `season_plan_entries_member_view_published` auf. Heute folgenlos (alle 88 Zeilen `published`), ab dem ersten Entwurf nicht mehr.

**Verifikationsmethode** (empfohlen für jede künftige Policy-Konsolidierung): vor dem Anwenden alles in einer Transaktion mit `ROLLBACK` durchspielen und pro Rolle (`set local request.jwt.claims` + `set local role authenticated`) die sichtbaren Zeilen je betroffener Tabelle vorher/nachher zählen. Ergebnis hier: 27 von 28 Zähler-Paaren identisch, einzige Abweichung `users` für Superadmin 446 → 437 — exakt die 9 vereinsfremden User, die nur über den Bypass sichtbar waren.

`trainer_absences` — **erledigt am 12.08.2026** durch `20260812030000_trainer_absences_user_id_backfill.sql` (angewendet und verifiziert). Vorher sah die Tabelle nach einer Policy-Dublette aus, war aber keine: `trainers_can_view_own_absences` prüft `trainer_absences.user_id`, und die Spalte war in allen Zeilen NULL — der einzige funktionierende Trainer-Pfad war die ältere Policy mit dem E-Mail-Join zwischen `trainers` und `users`.

Umgesetzt:

- Trigger `trg_trainer_absences_set_user_id` leitet `user_id` bei INSERT und bei `UPDATE OF trainer_id` aus `trainers.user_id` ab. Nötig, weil ein Admin beim Anlegen nur `trainer_id` setzt — ohne den Trigger wäre die Zeile für den betroffenen Trainer unsichtbar, sobald der E-Mail-Join weg ist. BEFORE-Trigger laufen vor der RLS-`WITH CHECK`-Prüfung, der Trainer-INSERT funktioniert dadurch auch ohne explizites `user_id`.
- Backfill: 4 der 24 Zeilen aufgelöst. Die übrigen 20 hängen an 10 Trainer-Datensätzen aus abgebrochenen RLS-Integrationstests (`trainer-rls-<timestamp>@test.com`) plus dem Sentinel `unassigned@placeholder.local` — für keinen davon existiert eine passende `users`-Zeile, sie sind über E-Mail genauso wenig auflösbar. **Offen:** dieses Aufräumen ist ein `DELETE` auf Live-Daten und wurde bewusst nicht mitgemacht.
- Die vier E-Mail-Join-Policies (`Trainers can view/create/update/delete …`) sind entfernt und durch `user_id`-Varianten ersetzt.
- Nebenbefund mitgefixt: `trainers_can_manage_own_absences` lag als `FOR ALL` **ohne** Status-Bedingung an — Trainer durften damit auch bereits genehmigte Abwesenheiten ändern und löschen, während die abgelösten E-Mail-Policies dafür ein `status = 'pending'` hatten. Ersetzt durch getrennte INSERT/UPDATE/DELETE-Policies, die das `pending` wieder erzwingen.

Policy-Satz danach: je ein Trainer- und ein Admin-Pfad pro Kommando, keine Generationen mehr nebeneinander.

## FORCE RLS + anonyme Schreibrechte (Stand 12.08.2026, angewendet)

`20260812010000_force_rls_and_close_anon_writes.sql` — angewendet über `docker exec supabase-db psql` auf dem VPS (Stack `swingz`, nicht über den Pooler). Verifiziert: `relforcerowsecurity` ist auf allen 114 Tabellen an, INSERT-Policies mit `WITH CHECK (true)` für PUBLIC gibt es nur noch bei `registration_requests` (gewollt).

Inhalt und Befund:

- **FORCE RLS** auf allen 114 Tabellen. Wichtig: Das ändert heute faktisch **nichts** — Eigentümer aller Tabellen ist `postgres` mit `rolbypassrls = true`, und BYPASSRLS gewinnt immer gegen FORCE. Es wirkt erst, wenn die App auf eine Rolle ohne BYPASSRLS umgestellt wird.
- **Das eigentliche Risiko dahinter:** `DATABASE_URL` verbindet als `postgres` (BYPASSRLS). Die 26 API-Routes, die Drizzle statt Supabase-REST nutzen, umgehen RLS damit vollständig — dort schützt allein der Anwendungscode. Fix = dedizierte App-Rolle ohne BYPASSRLS + neue `DATABASE_URL`. Infra-Änderung, keine Migration.
- **Sechs INSERT-Policies mit `WITH CHECK (true)` ohne `TO`** (gelten also für PUBLIC inkl. `anon`, und `anon` hat auf allen sechs das INSERT-Grant): `email_queue`, `nuliga_sync_log`, `newsletter_send_logs`, `rate_history`, `gamification_badges`, `registration_requests`. Vier der Namen sagen selbst „System"/„service role" — gemeint war `service_role`, gewirkt hat jeder. **`email_queue` ist der gravierendste Fall**: anonyme Zeilen in der Versand-Warteschlange bedeuten Mailversand über `noreply@swingz.cloud`, also Spam-/Phishing-Relay auf Kosten der Domain-Reputation. Gedroppt werden die vier reinen Service-Fälle; `gamification_badges` wird auf `TO authenticated` beschnitten (Schreibpfad läuft über `withApiAuth`); `registration_requests` bleibt bewusst offen (öffentlicher Registrierungspfad).

Weitere Befunde desselben Audits, **noch offen**:

- **`season_planning_configs` und `season_statistics`**: RLS an, aber **0 Policies** — nur über den Service-Client erreichbar.
- **`20260812020000_scope_remaining_superadmin_policies.sql` — Datei liegt, noch NICHT angewendet** (Tool-Blockade in der Session, nicht DB-seitig). Behandelt die letzten drei echten Kandidaten mit unscoped `is_superadmin()`: `audit_logs` SELECT (zwei Policies zu einer auf `is_club_admin(club_id)` zusammengeführt), `trainers` ALL (ersetzt durch SELECT/UPDATE/DELETE club-scoped über `trainer_club`; kein INSERT-Pendant, weil Trainer per Service-Client angelegt werden) und `users` UPDATE (club-scoped über `user_club_memberships`). Trockenlauf mit `ROLLBACK` bestätigt: `audit_logs` 2 → 1 sichtbare Zeile für Admin und Superadmin (die zweite gehörte einem anderen Verein — beabsichtigte Verschärfung), `trainers` für Admin 0 → 12 (Admins hatten auf `trainers` bisher überhaupt keine RLS-Policy, nur `trainers_own` und den Superadmin-Bypass), alles andere unverändert.
- **Verbleibende unscoped `is_superadmin()`-Policies nach diesem Durchgang, alle bewusst so**: `billing_periods`, `billing_line_items`, `trainer_billings` (per Ticket zurückgestellt, siehe unten), `background_jobs`, `base_interest_rates`, `school_holidays` (plattformweite Konzepte ohne Vereinsbezug).
- **Der Pooler auf `supabase.swingz.cloud:6543` akzeptiert Klartext-Verbindungen** (Verbindung mit `ssl: false` erfolgreich, mit TLS „wrong version number"). DB-Credentials und Nutzdaten gehen unverschlüsselt über die Leitung. VPS-Thema, keine Migration.

## Bewusst zurückgestellt (siehe `docs/tickets/`)

- **`billing_periods` / `trainer_billings` / `billing_line_items`**: kein `club_id` in der Tabelle erreichbar — vermutlich ein plattformweites Konzept, nicht pro Verein. `trainer_billings`/`billing_line_items` vergleichen zudem `trainer_id` direkt mit `auth.uid()` (derselbe Bug, der für `hours_logs`/`attendance_records`/`trainer_availabilities` bereits gefixt wurde). Ticket: `docs/tickets/TICKET-billing-tables-rls-scoping.md`.
- **`background_jobs`**: `club_id` steckt nur optional in einem JSONB-Payload-Feld, nicht jeder Job ist vereinsbezogen — bewusst unscoped gelassen, kein Ticket nötig.

## Dateihygiene `supabase/migrations/` (Stand 25.07.2026)

Vollständiger Ordner-Check: 156 Migrationsdateien, alle bis auf zwei folgen dem `YYYYMMDD[HHMMSS]_name.sql`-Schema.

- Die 5 jüngsten Migrationen (`20260804000000` bis `20260805010000`, siehe oben) lagen nach der letzten Session nur lokal vor (`git status` zeigte `??`) — jetzt committet. Live-Check per `docker exec supabase-db psql` bestätigt: `get_user_role`/`club_members` existieren nicht mehr, `is_superadmin_of` existiert — Dateien und Live-DB stimmen überein.
- `fix_booking_rpc_and_overlap.sql` (kein Zeitstempel-Präfix) → umbenannt zu `20260505030000_fix_booking_rpc_and_overlap.sql`. Live-Check bestätigt: die `create_booking_safe`-Signatur in der DB entspricht exakt dieser Datei (kein späteres Migration überschreibt sie) — reine Umbenennung, keine erneute Anwendung nötig.
- `TEMPLATE_person_user_split.sql` (im eigenen Header als "NOT APPLIED" markiert, Referenz auf das archivierte `docs/ARCHIV/2026-05-06-INTEGRATION_ROADMAP.md`) → verschoben nach `docs/ARCHIV/`, da `supabase/migrations/` nur echte Historie enthalten soll.
- `supabase_migrations.schema_migrations` existiert seit 26.07.2026 live, aber nur mit 8 Zeilen (Details: siehe Kernaussage oben) — Reconciliation-Script (`file-count-vs-claim-reconciliation.sh`, CI: `db-audit.yml`) zeigt entsprechend weiterhin eine große Lücke, per ADR-002 als Soft-Fail/Warning, nicht CI-Blocker.

## Benachrichtigungen: erlaubte Typen (Stand 13.08.2026, angewendet)

`notifications_type_check` ließ nur `info | warning | success | error | booking | invoice | training`
zu. Der Anwendungscode schrieb an zehn Stellen Benachrichtigungen, davon **neun mit einem Typ,
den die Constraint verbot** (`waitlist_promoted`, `member_deactivated`, `absence_alert`, `billing`,
`message_received`, `membership_created`, `booking_cancelled`, `booking_reactivated`, `waitlist`).

Jeder dieser Inserts schlug fehl. Weil alle Aufrufer den Fehler bewusst als nicht-fatal abfangen
(eine misslungene Benachrichtigung soll die eigentliche Aktion nicht zurückrollen), fiel es
nirgends auf: Die Tabelle enthielt zum Zeitpunkt des Funds **systemweit 0 Zeilen**.

Migration `20260813090000_notifications_type_values.sql` ersetzt die Constraint unter demselben
Namen und nimmt die tatsächlich verwendeten Typen auf; die bisher erlaubten bleiben gültig.
Angewendet und per `pg_constraint` nachgeprüft.

**Regel für neue Benachrichtigungstypen:** Ein neuer `type`-Wert im Code braucht eine Migration,
die ihn in die Constraint aufnimmt — sonst verschwindet die Benachrichtigung lautlos.

## `court_types`: Live-Tabelle ≠ Migrationsdatei (Stand 13.08.2026, geprüft)

`supabase/migrations/20260503_court_booking_system.sql` legt `court_types` **ohne `club_id`** an,
mit global eindeutigem `name` und der Policy `authenticated_users_can_view_court_types`
(`USING (auth.uid() IS NOT NULL)` — jeder Angemeldete sieht alles). Die Live-Tabelle sieht anders
aus; die Migrationsdatei ist an dieser Stelle Historie, nicht Ist-Zustand:

| Merkmal              | Migrationsdatei | Live (13.08.2026 gemessen)                           |
| -------------------- | --------------- | ---------------------------------------------------- |
| `club_id`            | existiert nicht | vorhanden                                            |
| `name`               | global `UNIQUE` | pro Verein — zwei Clubs dürfen denselben Namen haben |
| RLS-Sicht (Mitglied) | alle Zeilen     | nur der eigene Verein                                |

Verifiziert ohne SQL-Zugang, rein über PostgREST: zwei Zeilen gleichen Namens für zwei
verschiedene Clubs anlegen (beide `201` → kein globaler UNIQUE), dann dieselbe Tabelle mit dem
JWT eines Mitglieds von Club A lesen (nur Club-A-Zeile sichtbar → RLS ist club-scoped).
Beide Testzeilen wurden sofort wieder gelöscht.

**Die RLS-Trennung greift also — sie greift nur dort nicht, wo sie umgangen wird.**
`lib/booking/court.service.ts` arbeitet über `createServiceClient()` (RLS aus) und filterte bis
13.08.2026 in keiner einzigen `court_types`-Query auf `club_id`. `GET /api/court-types` lieferte
dadurch jedem angemeldeten Mitglied die Platztypen samt `hourly_rate` **aller** Vereine, `PATCH`
und `DELETE` trafen fremde Zeilen allein über die ID. Gefixt durch `club_id`-Filter in allen fünf
Service-Methoden plus Durchreichen von `auth.clubId` in beiden Routen.

**Regel:** Jede Query über den Service-Client trägt ihren Mandantenfilter selbst. RLS als
Sicherheitsnetz zu unterstellen ist dort falsch — es ist per Definition abgeschaltet.

## Prozess-Regel für künftige Migrationen

Siehe `AGENTS.md` → Abschnitt "Migrationen" für die verbindliche Regel (Live-Zustand vor Schreiben prüfen, exakte Policy-Namen aus `pg_policies` übernehmen statt aus alten Migrationsdateien zu raten, diese Datei bei jeder Policy-relevanten Änderung aktualisieren).
