# Offene Punkte & nächste Schritte

> Zuletzt verifiziert: 20. September 2026 (nuLiga-Scraper entfernt, Widget statt Abruf; davor 18. September 2026: Abgleich gegen Code und Produktion: E-Mail, rohe DB-Fehler, CI-Mocks, P3-Punkte erledigt; nuLiga-Rechtsklärung als Launch-Punkt ergänzt); davor 17. September 2026 (Auslieferung von 33 Commits nach main, 8 Migrationen
> auf Produktion angewendet, Deploy-Kette geprüft — drei neue Befunde unten); davor 16. September
> 2026 (ADR-005-Migrationsfortschritt am Code geprüft); 30. August 2026 (Bezahlschranke
> abgeschaltet — siehe unten)
>
> Lebendes Dokument. Bündelt **alle dokumentierten, aber noch nicht umgesetzten** Altlasten und
> ToDos. Wer einen Punkt umsetzt, streicht ihn hier; wer einen neuen offenen Punkt findet, trägt
> ihn ein. Kein Parallel-Dokument danebenlegen (siehe `AGENTS.md`).

## So ist dieses Dokument zu lesen

- **P0** — blockiert Betrieb, Verkauf oder Sicherheit. Zuerst anpacken.
- **P1** — wichtig (Korrektheit, Datenschutz, Datenhygiene).
- **P2** — Politur, Ehrlichkeit der Oberfläche, Struktur.
- **P3** — Kleinigkeiten.
- **Produkt-Roadmap** — zurückgestellte Features/Tickets, niedrige Priorität.

Quellen: die vier Archiv-Snapshots vom 13.08.2026 (`docs/ARCHIV/2026-08-13-*`),
`docs/DATABASE.md`, `docs/EMAIL_SETUP.md` sowie das **eingefrorene** Ticket-System
`docs/tickets/` (Stand Juni 2026, wird nicht mehr gepflegt — siehe Banner dort).

---

## Vor dem Launch — zwingend zurückdrehen

### nuLiga: Scraper entfernt, Widget statt Abruf (20.09.2026)

Die AGB von tennis.de untersagen Scraping und gewerbliche Weiterverwendung. Der Scraper
(`lib/services/nuliga-scraper.ts`), der Sync, der Cron und die Import-Oberfläche sind gelöscht.
Ersatz: das von tennis.de zum Einbetten freigegebene Mannschaftswidget
(`components/tennisde-widget.tsx`; Verband + Vereinsnummer unter Einstellungen → Verein) und der
manuelle CSV-Import. Offen vor dem Launch: beim tennis.de Service-Center klären, ob das Widget in
einer SaaS (statt auf der Vereinshomepage) erlaubt ist und wie es mit dem eingeblendeten
PREMIUM-Werbebanner steht. `league_players` hat derzeit keine Befüllung mehr (Kader, „Meine
Mannschaften"-Zuordnung): Entscheidung nötig, ob es manuell gepflegt wird oder entfällt.

### Automatische Auslieferung und Auto-Migration

`deploy.yml` deployt jeden grünen Push auf `main` nach Produktion; mit `AUTO_MIGRATE=true`
laufen dabei auch die Migrationen ohne Rückfrage. Für die Entwicklungsphase gewollt.
**Vor dem Launch:** Repo-Variable `AUTO_MIGRATE` löschen (Migrationen wieder von Hand nach
Sichtung mit `pnpm db:status:prod`), und entscheiden, ob Pull Requests mit Freigabe wieder
Pflicht werden. Einrichtung: Secret `VERCEL_TOKEN` setzen, vorher `pnpm db:status:prod`
prüfen, erst dann `gh variable set AUTO_MIGRATE --body true`.

### Bezahlschranke ist abgeschaltet

`SUBSCRIPTION_ENFORCEMENT=off` ist gesetzt (lokal und in Vercel Production).
Solange das gilt, gibt `getSubscriptionState()` für **jeden** Nutzer `ok` zurück:
jeder Verein hat vollen Zugriff ohne Abo, der Mahnfall greift nicht, und die
API-Sperre in `lib/api-auth.ts` läuft leer.

**Warum:** Die Testvereine sollen bis zum offiziellen Launch benutzbar sein,
ohne dass für sie echtes Geld bewegt wird. Ohne die Abschaltung zeigt jede
Seite unter `app/(protected)/admin/(gated)/` nur die Bezahlschranke — der
gesamte Vereinsbereich wäre unbenutzbar.

**Zurückdrehen — zwei Schritte, sonst nichts:**

```bash
# 1. lokal
sed -i '/^SUBSCRIPTION_ENFORCEMENT=/d' .env.local

# 2. Produktion
vercel env rm SUBSCRIPTION_ENFORCEMENT production
vercel --prod            # Git-Deploy ist auf dem Hobby-Plan BLOCKED
```

Danach prüfen: ein Konto ohne Abo (`users.subscription_tier = 'free'`) muss auf
`/admin/members` die Bezahlschranke sehen.

**Warum das nicht vergessen werden kann:**

| Sicherung                | Wirkung                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Vorgabe ist **scharf**   | Nur exakt `off` schaltet ab. Variable weg = Schranke da. Vergessen führt nicht zu verschenktem Umsatz.     |
| Warnung im Log           | `[subscription-gate] SUBSCRIPTION_ENFORCEMENT=off …`, einmal je Prozess                                    |
| Leiste in der Oberfläche | `SubscriptionDisabledBanner` steht auf **jeder** Admin- und Superadmin-Seite, solange der Schalter aus ist |
| Test                     | `subscription-gate.test.ts` prüft, dass die Vorgabe scharf ist und kein anderer Wert abschaltet            |

Code: `lib/subscription-gate.ts` (`isSubscriptionEnforced`), `lib/env.ts`,
`components/billing/subscription-disabled-banner.tsx`.

---

## P0 — Blocker

### ✅ Erledigt 17.09.2026 — GitHub Actions war für das Repository abgeschaltet

`GET /repos/swingz369/swingz_tennis/actions/permissions` lieferte `{"enabled": false}`. Folge:
CI lief seit dem 18.08.2026 nicht mehr, der `monitor`-Workflow seit dem 21.08.2026 nicht — es
fand also keine Überwachung statt. Auf `enabled: true, allowed_actions: all` gestellt; der erste
CI-Lauf danach (`9283b67d`) bestätigte: Typecheck und Unit-Tests grün, nur das `audit`-Gate rot
(siehe eigener Punkt unten — unabhängige, vorbestehende Ursache).
→ **Noch offen:** warum die drei Monitor-Läufe vom 21.08. fehlschlugen, ist nicht untersucht —
der Workflow selbst lief seither nicht wieder, weil er nur alle 30 Minuten per `schedule` feuert.

### ✅ Erledigt 17.09.2026 — Dependency-Audit-Gate in CI war rot

Erster CI-Lauf nach dem Wiedereinschalten (17.09.2026, Commit `9283b67d`) zeigte: der Job
„Dependency Audit (high+critical gate)“ (`.github/workflows/ci.yml`, `pnpm audit --audit-level=high`)
schlug fehl — 16 Funde, davon 8 hoch/2 kritisch. Der schwerste Fund stand nicht in der ersten
Fassung dieses Eintrags: **`next` selbst war kritisch** (16.2.11, verwundbar <16.3.3), dazu
`sharp` (hoch, über `next`) und `fast-uri` (hoch, über `@sentry/nextjs > webpack > ajv`).

Behoben durch Anheben der Top-Level-Pakete (`next`, `@tiptap/*`, samt der mit Next versionierten
`eslint-config-next` und `@next/bundle-analyzer`) und Hochziehen der bereits vorhandenen
`pnpm.overrides` für die rein transitiven Funde. Wie im ursprünglichen Fix-Vorschlag verlangt
per aufgelöster Version verifiziert statt nur `pnpm audit` grün gefärbt:

| Paket          | vorher  | jetzt      | gepatcht ab |
| -------------- | ------- | ---------- | ----------- |
| `next`         | 16.2.11 | **16.3.5** | 16.3.3      |
| `js-yaml`      | <4.3.2  | **4.3.2**  | 4.3.2       |
| `smol-toml`    | ≤1.7.0  | **1.8.0**  | 1.7.1       |
| `fast-uri`     | <3.1.6  | **3.1.8**  | 3.1.6       |
| `sharp`        | <0.35.4 | **0.35.4** | 0.35.4      |
| `@tiptap/core` | <3.30.5 | **3.31.3** | 3.30.5      |

`pnpm audit --audit-level=high` endet jetzt mit Exit 0 (3 moderate verbleiben unterhalb der
Gate-Schwelle: `csv-parse`, `vitest`, `@vitest/mocker` — `csv-parse` bräuchte einen
Major-Sprung 6→7 und gehört deshalb in einen eigenen Vorgang). Typecheck grün, 1700 Unit-Tests
grün, Produktions-Build kompiliert.
→ Quelle: `gh run view 35246848376 -R swingz369/swingz_tennis --log-failed`.

### Vier Testdateien fallen nur in CI um (umgebungsabhängige Tests)

Der Job „Typecheck + Unit Tests“ ist rot, obwohl lokal alle 1700 Tests grün sind — die Tests
hängen an der Umgebung statt an der Logik. Zwei verschiedene Ursachen:

1. **Zeitzone — behoben 17.09.2026.** `src/__tests__/lib/court-calendar-utils.test.ts` fiel mit
   11 Tests um. Die Kalender-Helfer rechnen bewusst in der Laufzeit-Zeitzone (`setHours`), weil
   sie ausschließlich in Client-Komponenten laufen — im Browser eines deutschen Vereinsmitglieds
   ist das korrekt. Der Testlauf erbte aber die Zeitzone der Maschine: lokal (CEST) grün, in CI
   (UTC) rot, weil das Fixture `2026-06-08T00:00:00+02:00` unter UTC auf den 7. Juni zurückfällt.
   `vitest.config.ts` nagelt den Lauf jetzt hart auf `Europe/Berlin`. Gegengeprüft mit erzwungenem
   `TZ=UTC`: 48 von 48 grün.
2. **Unvollständige Mocks — behoben 18.09.2026** (fehlende `RESEND_API_KEY`/`STRIPE_PRICE_*` per `vi.hoisted` gesetzt; Lauf ohne `.env.local` grün, 20/20).
   Ursprüngliche Beschreibung: `api/email-campaigns.test.ts`, `api/stripe-subscribe.test.ts`
   und `api/webhooks-stripe.test.ts` antworten in CI mit 500/503. Sie bestehen lokal nur, weil
   `src/__tests__/setup.ts` die `.env.local` lädt und damit eine echte lokale Supabase-Instanz
   trifft; in CI stehen dort bewusst Platzhalter (`ci.yml`, Kommentar im `env:`-Block), und die
   Mocks dieser drei Dateien greifen nicht weit genug.
   → **Fix:** Supabase-/Stripe-Client in diesen drei Dateien vollständig mocken, sodass sie ohne
   `.env.local` bestehen. Gegenprobe: Lauf ohne geladene `.env.local` muss grün sein.
   Ein Test, der eine laufende lokale Datenbank voraussetzt, schützt in CI nichts.

### ✅ Erledigt (Stand 18.09.2026 geprüft) — E-Mail-Versand

Die Annahme „`swingz.cloud` nicht verifiziert" ist überholt: Resend meldet `swingz.cloud` als
`verified` (eu-west-1), Vercel Production hat `EMAIL_FROM="SwingZ <noreply@swingz.cloud>"` und
`RESEND_API_KEY`. → **Noch nicht belegt:** ein echter Versand aus der Produktion (der Prod-Key ist
in Vercel verborgen und gehört hoffentlich zum selben Resend-Team wie die Domain, siehe
`docs/EMAIL_SETUP.md` Falle 3). Einmal eine Rechnung/Testmail in Produktion auslösen.

### ✅ Erledigt (Stand 18.09.2026 geprüft) — Rohe SQL-/DB-Fehler

Alle `error.message`-Treffer in `app/api/` sind Logzeilen; der Catch in `withApiAuth`
(`lib/api-auth.ts`) filtert Handler-Fehler zentral. Bewacht wird das von
`src/__tests__/security/no-raw-db-errors.test.ts`.

### Drizzle-Service-Pfad umgeht RLS komplett

`DATABASE_URL` verbindet als `postgres` (BYPASSRLS). Die verbleibenden API-Routes, die Drizzle
statt Supabase-REST nutzen, schützt allein der Anwendungscode. FORCE-RLS wirkt erst, wenn die
App auf eine Rolle ohne BYPASSRLS umgestellt wird. → **Fix:** dedizierte App-Rolle ohne
BYPASSRLS + neue `DATABASE_URL` (Infra-Änderung, keine Migration).
→ Quelle: `docs/DATABASE.md`, `docs/tickets/roadmap/TICKET-pooler-tls-und-drizzle-service-pfad.md`.

**Update 16.09.2026:** ADR-005 (13.09.) hat diesen Pfad zum Zielbild gemacht (Route → Service →
Repository → `getUserDb`/`systemDb`). Seit der Entscheidung migrierte Domänen haben den
Drizzle-Anteil deutlich reduziert (Routen mit Drizzle-Import: 21, war ~85), den gefährlicheren
`createServiceClient`-Bypass aber kaum (84 Routen, war ~86 — davon nur 3 über den auditierten
`systemDb(reason)`-Wrapper). Genau dieser Pfad war laut ADR-005-Kontext Ursache der zwei echten
Datenlecks im Juli. Voller Befund mit Zahlen und Befehlen:
`docs/ARCHIV/2026-09-16-adr-005-migrationsfortschritt-befund.md`.

### DB-Transport unverschlüsselt

Der Pooler `supabase.swingz.cloud:6543` akzeptiert Klartext (mit TLS „wrong version number").
Credentials und Nutzdaten gehen unverschlüsselt über die Leitung. VPS-Thema.
→ Quelle: `docs/DATABASE.md`, `docs/tickets/roadmap/TICKET-pooler-tls-und-drizzle-service-pfad.md`.

### Migration liegt, ist aber nie angewendet (RLS-Scoping)

`20260812020000_scope_remaining_superadmin_policies.sql` — angelegt, **nicht** angewendet.
Behandelt die letzten unscoped `is_superadmin()`-Policies auf `audit_logs`, `trainers`, `users`.
→ **Fix:** per `docker exec supabase-db psql` anwenden (Trockenlauf mit `ROLLBACK` lief bereits).
→ Quelle: `docs/DATABASE.md`.

### Tabellen mit RLS aber ohne Policies

`season_planning_configs` und `season_statistics`: RLS an, **0 Policies** — nur über den
Service-Client erreichbar. → **Fix:** Policies definieren oder bewusst dokumentieren.
→ Quelle: `docs/DATABASE.md`.

---

## P1 — Wichtig

- **Drei Cron-Routen haben keinen Zeitplan.** `cron/trial-followup`, `cron/check-absences` und
  `cron/refresh-base-rates` stehen weder in `vercel.json` (6 Einträge) noch in einem
  GitHub-Workflow. Der Nurture-Flow des Probetrainings verschickt damit weder die Erinnerung nach
  2 Tagen noch den letzten Anstoß nach 7 Tagen. → **Entscheiden:** einplanen oder Route löschen.
  → Quelle: Befund 17.09.2026 beim Modul-Diagramm (`docs/diagrams/swingz-overview.html`).
- **`cron-booking-reminders` hat nie einen Heartbeat geschrieben.** `/api/health` meldet für
  diesen Job dauerhaft `"status": "unbekannt"`, während alle anderen Jobs Altersangaben liefern.
  Die Route `/api/reminders/booking-tomorrow` steht in `vercel.json` (18:00). → **Prüfen**, ob der
  Job scheitert, bevor `recordHeartbeat()` greift.
  → Quelle: `/api/health` in Produktion, 17.09.2026.
- **✅ Erledigt 17.09.2026** — Repository war umgezogen (`swingz369/swingz` →
  `swingz369/swingz_tennis`), `git remote` und `docs/SERVICES.md` zeigten noch auf den alten
  Namen. Beides nachgezogen.
- **✅ Erledigt 18.09.2026 — ADR-005: Service-Schicht in migrierten Routen.** Gruppen,
  Preisregeln, Auswertungen (`analytics/*`) und `clubs/[id]` laufen über je einen Service; die
  Drizzle-Repositories für Buchungen, Termine und Vereine sind entfernt. `bookings`,
  `stripe/checkout` und `schedule` greifen nicht mehr auf Repositories zu.
- **Umsatz-Export (`/api/analytics/revenue/export`) liefert Platzhalterdaten.** Pauschal 15 €
  je bestätigter Buchung, Zahlungsmethode **zufällig**, Mitgliedsname „Member N“ — stammt aus dem
  alten Use-Case und wurde 1:1 übernommen. → **Entscheiden:** auf `invoices` umstellen oder den
  Export entfernen, bevor ein Verein ihn für die Buchhaltung nutzt.
- **Insights (`/api/analytics/insights`) sind Attrappe.** `lastVisit` wird nie befüllt, damit gilt
  jedes Mitglied als „hohes Abwanderungsrisiko“.
- **RLS auf `bookings` zu weit.** Policy `booking_access` (ALL) lässt jedes Vereinsmitglied alle
  Buchungen des Vereins lesen und ändern.
- **Architektur-Baseline-Datei (`dependency-cruiser`) nicht aktuell gehalten.**
  `.dependency-cruiser-known-violations.json` ist seit dem 13.09.2026 eingefroren; `npm run
arch:check` läuft mit `--ignore-known` dagegen und meldet "grün", obwohl der reale Verstoß-Stand
  sich seither kaum bewegt hat (172 aktuelle Treffer vs. 174 in der Baseline trotz 8
  Migrations-Commits). → **Fix:** `npm run arch:baseline` als festen Schritt bei jedem
  ADR-005-Phase-3-Commit, oder CI-Gate gegen Anstieg der Verstoßzahl.
  → Quelle: `docs/ARCHIV/2026-09-16-adr-005-migrationsfortschritt-befund.md` (Befund 1).
- **SECURITY DEFINER-Funktionen ohne eigenen Autorisierungs-Check: systematisch prüfen.**
  Fund bei ADR-005 Phase 3 (Abrechnungslauf, 14.09.2026): `generate_season_invoices_atomic`
  war an `authenticated` gegrantet und umging RLS (SECURITY DEFINER) komplett, ohne selbst zu
  prüfen, ob der Aufrufer Admin des übergebenen Clubs ist — gefixt in
  `20260914120000_generate_season_invoices_atomic_auth_check.sql`. 51 SECURITY DEFINER-Funktionen
  sind insgesamt an `authenticated` gegrantet; nur diese eine wurde geprüft. → **Systematisch
  durchgehen**, v. a. schreibende (`create_invoice_with_items`, `add_balance_entry_atomic`,
  `increment_member_balance` fallen auf den ersten Blick auf — noch nicht geprüft, ob sie
  ungenutzt oder ebenfalls ungeschützt sind).
  → Quelle: `docs/DATABASE.md` § SECURITY DEFINER-Funktionen ohne eigenen Autorisierungs-Check.
- **`users` ist für jedes Mitglied vollständig lesbar (cross-tenant).** `GET /rest/v1/users`
  liefert Namen aller Nutzer aller Vereine. → **Entscheiden**, ob gewollt; die neue
  `directory`-Route gibt bewusst nur den eigenen Verein heraus.
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **Abrechnungstabellen unscoped.** `billing_periods` / `trainer_billings` / `billing_line_items`
  haben kein erreichbares `club_id`; `trainer_billings`/`billing_line_items` vergleichen
  `trainer_id` mit `auth.uid()` (Bug-Klasse, die für `hours_logs` etc. schon gefixt ist).
  → **Teilerledigt 15.08.2026:** fachliche Entscheidung „pro Verein“ getroffen; Migration
  `supabase/migrations/20260815180000_billing_tables_club_scoping.sql` vorbereitet
  (`billing_periods.club_id` + Backfill + NOT NULL, `is_superadmin_of(club_id)`-Scoping,
  `trainers.user_id = auth.uid()`-Fix, Drizzle-Schema um `club_id` ergänzt). **Offen:**
  Migration vom Owner auf die Live-DB anwenden (vorher Policy-Namen per `pg_policies` verifizieren).
  → Quelle: `docs/DATABASE.md`, `docs/tickets/roadmap/TICKET-billing-tables-rls-scoping.md`.
- **Pflicht-Abo für Neukonten fehlt.** Neukonten starten im Freemium-Default; Abo-Enforcement
  für Neuanmeldungen ist als Folge-Ticket zurückgestellt.
  → Quelle: `docs/tickets/roadmap/TICKET-mandatory-subscription-onboarding.md`.
- **Migrations-Tracking unvollständig.** `supabase_migrations.schema_migrations` kennt nur
  8 von 155 Dateien; die Reconciliation-Lücke bleibt (per ADR-002 Soft-Fail, nicht CI-Blocker).
  → Quelle: `docs/DATABASE.md`.
- **`20260701010000_widen_season_planning_history_action_type_check.sql` nie angewendet.**
  Die Auto-Planung läuft inzwischen über `plan_created` (Workaround), aber die Migration selbst
  fehlt, und das Drizzle-Schema kennt fünf Spalten der Tabelle nicht.
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **Verwaiste Session-Einheiten in Bestandsdaten.** Vereine, die vor dem B5-Fix nach dem
  Veröffentlichen neu geplant haben, tragen `sessions.plan_entry_id IS NULL`-Geistertermine.
  Vor dem nächsten Veröffentlichen prüfen (keine Auto-Migration, weil dabei echte Buchungen
  gelöscht würden). → **SQL vorbereitet 15.08.2026** — Diagnose-Queries in `docs/DATABASE.md`
  (Abschnitt „Offene Datenhygiene-Aufräumung“); löschen erst nach Sichtung durch den Owner.
  → Quelle: `docs/ARCHIV/2026-08-13-kernmodul-durchlauf.md` (B5).
- **`trainer_absences`: 20 unauflösbare Zeilen.** Hängen an Test-Trainern ohne `users`-Zeile;
  bewusst kein `DELETE` auf Live-Daten mitgemacht. → **SQL vorbereitet 15.08.2026** — guarded
  `DELETE` (nur Trainer ohne `users`-Zeile) in `docs/DATABASE.md` (Abschnitt „Offene
  Datenhygiene-Aufräumung“).
  → Quelle: `docs/DATABASE.md`.
- **Integrationstests laufen in CI nie — und liefen lokal gegen Produktion.** 10 Tests
  (`billing-engine`, `payment-flow`, `rls-policies`, `stripe-webhook`, …) skippen ohne
  `SUPABASE_SERVICE_ROLE_KEY`. → **Teilerledigt 15.08.2026:** gemeinsamer Helper
  `src/__tests__/helpers/integration.ts` (`hasIntegrationEnv()`) skippt die Tests jetzt zusätzlich
  hart, sobald `NEXT_PUBLIC_SUPABASE_URL` auf die Produktions-Instanz zeigt — es werden keine
  Testdaten mehr in die Live-DB geschrieben. **Offen:** eine echte Test-/Staging-Supabase +
  `.env.test`, damit die Tests in CI/lokal überhaupt wieder _laufen_ (statt nur zu skippen).
  → Quelle: `docs/ARCHIV/2026-08-13-test-audit.md` (P1), Befund 15.08.2026.
- **✅ Erledigt 15.08.2026** — `global-setup.ts` mutierte die DB aus `.env.local`. Ein Guard
  (`isProductionDbTarget`, Prod-Hosts `supabase.swingz.cloud`/`178.254.37.110`) verhindert
  jetzt `drizzle-kit push` + Test-DDL gegen Produktion (Schema-Mutationsschutz).
  → Quelle: `docs/ARCHIV/2026-08-13-test-audit.md` (P1).

---

## P2 — Politur & Ehrlichkeit der Oberfläche

- **Denglisch „Season"** (18.09.2026: drei Fehlertexte auf „Saison" gezogen; Rest ungeprüft) in sichtbaren Texten der Saison-Unterseiten (`seasons/[id]/page.tsx`,
  `seasons/[id]/edit/…`, `seasons/[id]/planning/steps/*`, `seasons/loading.tsx`). UI-Text von
  Code-Bezeichnern trennen — keine pauschale Ersetzung.
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **`/gamification` verschleiert einen 403** als „0 Punkte / 0 Badges" statt zu sagen, dass das
  Modul nicht aktiviert ist (Fail-open-Darstellung). ✅ **Erledigt 15.08.2026** — das Dashboard
  prüft jetzt `res.ok` und zeigt bei deaktiviertem Modul einen klaren Hinweis statt Nullen.
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **`/news`** (Command-Palette) landet auf `/messages` — Eintrag ohne eigenes Ziel.
  ✅ **Erledigt 15.08.2026** — redundanter Palette-Eintrag entfernt (`/messages` ist bereits
  verlinkt).
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **Mitglieder-CSV-Import liegt in `/admin/settings`**, nicht in der Mitgliederverwaltung —
  dort gibt es nur „Export CSV". ✅ **Erledigt 15.08.2026** — `MemberImportDialog` jetzt auch
  in der Mitgliederverwaltung (`/admin/members`) eingehängt.
  → Quelle: `docs/ARCHIV/2026-08-13-ui-klickweg-kernfunktionen.md`.
- **Widersprüchliche Aussage im „Rechnungen generieren"-Dialog:** Warnhinweis „Keine aktive
  Mitgliedsgebühr konfiguriert" **und** aktiver Button „1 Rechnung erstellen".
  ✅ **Erledigt 15.08.2026** — Button ist bereits deaktiviert; Label zeigt jetzt ehrlich
  „Keine Gebühr konfiguriert" statt einer Rechnungsanzahl.
  → Quelle: `docs/ARCHIV/2026-08-13-ui-klickweg-kernfunktionen.md`.
- **Playwright-Matrix verkleinern.** ✅ **Erledigt 13.08.2026** — Standardlauf
  `pnpm test:e2e` = chromium + mobile-chrome, Vollmatrix über `pnpm test:e2e:full`.
  → Quelle: `docs/ARCHIV/2026-08-13-test-skills-umsetzung.md`.

---

## P3 — Kleinigkeiten

- ✅ 18.09.2026 erledigt bzw. gegenstandslos: Preiskategorien-Empty-State erklärt den Zweck;
  Rechnungsdialog zeigt bei leerer Suche „Keine Mitglieder vorhanden"; `/admin/courts` wählt den
  Belag statt des (leeren) Platztyps; `PUT …/setup` → 405 ist Standardverhalten, aufgerufen wird
  nur `PATCH`.
- `tests/e2e/all-pages-render.spec.ts:32` prüft `/member/preferences` nur gegen einen
  Überschriften-Regex — belegt keine Funktion.

→ Quellen: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`,
`docs/ARCHIV/2026-08-13-ui-klickweg-kernfunktionen.md`, `docs/ARCHIV/2026-08-13-test-audit.md`.

---

## Produkt-Roadmap (zurückgestellt, niedrige Priorität)

Eingefrorenes Ticket-System `docs/tickets/` (Stand Juni 2026) — offene Feature-/Strategie-Tickets,
die bewusst nicht im Kernweg liegen:

- DATEV-CSV-Export (F1), Übungsleiterpauschale (F2), Turnier-Auslosung (F5), SMS/WhatsApp (F8),
  Wallet-Pass (F10), echte Job-Queue/BullMQ (F11), Churn-Prediction (F12).
- DSGVO-Read-Audit-Trail (A4/B8), Pen-Test vor Q2-Auslieferung (B9), Decisions/Voting
  Sichtbarkeits-Boost (B7).
- Pay-per-Active-Member-Pricing (3.6.1–3.6.3), Smart-Court-Premium-Pricing (3.1.4),
  `training_groups` final droppen (3.7.4), `types/supabase.ts` regenerieren (3.7.2).
- Spikes: React-19-Migration, Tailwind-4-Migration (`docs/tickets/SPIKE-*.md`).

---

## Bewusst offen gelassen (Entscheidungen, kein Bug)

- Trainer/Mitglieder wechseln den Verein nicht — immer genau ein Vereinskontext (in
  `docs/BUSINESS_RULES.md` festgehalten).
- `background_jobs`, `base_interest_rates`, `school_holidays` bleiben unscoped
  (plattformweite Konzepte ohne Vereinsbezug).
- Kein automatisches „Undo" einer Abmeldung — überbuchungsfrei nur als eigener Vorgang denkbar.
