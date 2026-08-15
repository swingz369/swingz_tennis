# Offene Punkte & nächste Schritte

> Zuletzt verifiziert: 15. August 2026
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

## P0 — Blocker

### E-Mail-Versand ist komplett tot

`swingz.cloud` ist bei Resend nicht verifiziert. Damit geht **keine einzige** Mail raus:
Rechnungsversand (`POST /api/billing/invoices/[id]/send-email`) antwortet 500 und lässt die
Rechnung auf `draft`, das Mahnwesen erreicht niemanden, Saisonbestätigungen kommen nicht an.
Einladungen fallen auf den Einladungslink zurück (Sicherheitsnetz, kein Ersatz).
→ **Fix:** Domain verifizieren oder `EMAIL_FROM` auf eine verifizierte Domain umstellen.
→ Quelle: `docs/EMAIL_SETUP.md`, `docs/ARCHIV/2026-08-13-kernmodul-durchlauf.md` (F8).

### Rohe SQL-/DB-Fehler erreichen den Client

Der `auto-plan`-500 lieferte das komplette Drizzle-Statement inkl. Tabellen-/Spaltennamen an den
Browser. Der auslösende Bug ist behoben, das **ungefilterte Durchreichen** von `error.message`
nicht. → **Fix:** alle Routen prüfen, die `error.message` in die Antwort schreiben; deutsche
Fehlermeldung, kein Stack-/SQL-Trace (Regel aus `CLAUDE.md`).
→ Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md` (P0).

### Drizzle-Service-Pfad umgeht RLS komplett

`DATABASE_URL` verbindet als `postgres` (BYPASSRLS). Die ~26 API-Routes, die Drizzle statt
Supabase-REST nutzen, schützt allein der Anwendungscode. FORCE-RLS wirkt erst, wenn die App auf
eine Rolle ohne BYPASSRLS umgestellt wird. → **Fix:** dedizierte App-Rolle ohne BYPASSRLS + neue
`DATABASE_URL` (Infra-Änderung, keine Migration).
→ Quelle: `docs/DATABASE.md`, `docs/tickets/roadmap/TICKET-pooler-tls-und-drizzle-service-pfad.md`.

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

- **`users` ist für jedes Mitglied vollständig lesbar (cross-tenant).** `GET /rest/v1/users`
  liefert Namen aller Nutzer aller Vereine. → **Entscheiden**, ob gewollt; die neue
  `directory`-Route gibt bewusst nur den eigenen Verein heraus.
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **Abrechnungstabellen unscoped.** `billing_periods` / `trainer_billings` / `billing_line_items`
  haben kein erreichbares `club_id`; `trainer_billings`/`billing_line_items` vergleichen
  `trainer_id` mit `auth.uid()` (Bug-Klasse, die für `hours_logs` etc. schon gefixt ist).
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
  gelöscht würden).
  → Quelle: `docs/ARCHIV/2026-08-13-kernmodul-durchlauf.md` (B5).
- **`trainer_absences`: 20 unauflösbare Zeilen.** Hängen an Test-Trainern ohne `users`-Zeile;
  bewusst kein `DELETE` auf Live-Daten mitgemacht.
  → Quelle: `docs/DATABASE.md`.
- **Integrationstests laufen in CI nie.** 10 Tests (`billing-engine`, `payment-flow`,
  `rls-policies`, `stripe-webhook`, …) skippen ohne `SUPABASE_SERVICE_ROLE_KEY`.
  → Quelle: `docs/ARCHIV/2026-08-13-test-audit.md` (P1).
- **✅ Erledigt 15.08.2026** — `global-setup.ts` mutierte die DB aus `.env.local`. Ein Guard
  (`isProductionDbTarget`, Prod-Hosts `supabase.swingz.cloud`/`178.254.37.110`) verhindert
  jetzt `drizzle-kit push` + Test-DDL gegen Produktion und entleert den Service-Key, damit
  Integrationstests bei Prod-URL skippen.
  → Quelle: `docs/ARCHIV/2026-08-13-test-audit.md` (P1).

---

## P2 — Politur & Ehrlichkeit der Oberfläche

- **Denglisch „Season"** in sichtbaren Texten der Saison-Unterseiten (`seasons/[id]/page.tsx`,
  `seasons/[id]/edit/…`, `seasons/[id]/planning/steps/*`, `seasons/loading.tsx`). UI-Text von
  Code-Bezeichnern trennen — keine pauschale Ersetzung.
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **`/gamification` verschleiert einen 403** als „0 Punkte / 0 Badges" statt zu sagen, dass das
  Modul nicht aktiviert ist (Fail-open-Darstellung).
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **`/news`** (Command-Palette) landet auf `/messages` — Eintrag ohne eigenes Ziel.
  → Quelle: `docs/ARCHIV/2026-08-13-nav-workflow-audit.md`.
- **Mitglieder-CSV-Import liegt in `/admin/settings`**, nicht in der Mitgliederverwaltung —
  dort gibt es nur „Export CSV". → Dialog zusätzlich auf `/admin/members` einhängen.
  → Quelle: `docs/ARCHIV/2026-08-13-ui-klickweg-kernfunktionen.md`.
- **Widersprüchliche Aussage im „Rechnungen generieren"-Dialog:** Warnhinweis „Keine aktive
  Mitgliedsgebühr konfiguriert" **und** aktiver Button „1 Rechnung erstellen".
  → Quelle: `docs/ARCHIV/2026-08-13-ui-klickweg-kernfunktionen.md`.
- **Playwright-Matrix verkleinern.** ✅ **Erledigt 13.08.2026** — Standardlauf
  `pnpm test:e2e` = chromium + mobile-chrome, Vollmatrix über `pnpm test:e2e:full`.
  → Quelle: `docs/ARCHIV/2026-08-13-test-skills-umsetzung.md`.

---

## P3 — Kleinigkeiten

- `PUT /api/clubs/[id]/setup` gibt ein nacktes 405 ohne Fehlertext (nur `PATCH` existiert).
- Empty State der Preiskategorien erklärt nicht, wozu Kategorien dienen (Gegenbeispiel:
  vorbildlicher Platz-Empty-State).
- Rechnungsdialog zeigt bei leerer Suche „Keine Ergebnisse für ‚'" statt der vorhandenen Mitglieder.
- `/admin/courts`: „Platztypen verwalten · 0 Typen" passt nicht zur Auswahl im Formular.
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
