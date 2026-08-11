# Produktaudit SwingZ — Weg zur Verkaufsreife

> Stand: 26. Juli 2026
> Methode: Direktanalyse am Code (1.356 TS-Dateien), `next build`, `tsc --noEmit`, `vitest run`, Migrationsscan über 155 SQL-Dateien, Marktrecherche.
> **Keine Doku-Übernahme** — alle Zahlen sind am Code gemessen. Wo dieses Dokument von `docs/` oder `CLAUDE.md` abweicht, gilt dieses Dokument.
> Kategorie: Archiv-Snapshot (nach `AGENTS.md` §1). Abgeleitete Arbeitspakete gehören nach `docs/tickets/INDEX.md`.

---

## 0. Urteil in fünf Sätzen

1. **Das Fundament trägt technisch, aber nicht kommerziell.** Build grün, Typen grün, Verdrahtung sauber — aber das Geschäftsmodell ist im Code nicht durchgesetzt.
2. **Das größte Risiko ist keine Bugliste, sondern eine Architektur-Spaltung**: 146 Dateien greifen über Supabase-REST mit aktivem RLS auf die DB zu, 59 Dateien über Drizzle als **DB-Superuser ohne RLS**. Die Mandantentrennung — das Kernversprechen jedes Multi-Tenant-SaaS — ist an 59 Stellen reine Handarbeit.
3. **Die DB-Verbindung läuft unverschlüsselt über das offene Internet** (`ssl: false` gegen `supabase.swingz.cloud:6543`). Solange das so ist, kann man diese App keinem Verein mit Mitgliederdaten und SEPA-Mandaten verkaufen.
4. **Der Funktionsumfang ist etwa das Dreifache des Marktführers — bei null zahlenden Kunden.** 313 API-Routes, 115 Seiten, 111 RLS-Tabellen. Gamification, Shop, Wallet-Pässe, KI-Matchmaking, nuLiga-Scraper, Familienkonten sind gebaut, bevor ein einziger Verein die Kernfunktionen im Alltag bestätigt hat.
5. **Der Weg nach vorn ist Verengung, nicht Erweiterung**: Fundament abdichten (~1 Woche), Scope auf vier Kernmodule schneiden, als _Tennisschul-Betriebssystem_ positionieren — nicht als weiteres Platzbuchungssystem, denn dieses Rennen ist gegen ein kostenloses Produkt nicht zu gewinnen.

---

## 1. Messbare Basis

| Kennzahl                                          | Wert                                                | Bewertung                        |
| ------------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| TypeScript-Dateien (ohne node_modules)            | 1.356                                               | —                                |
| API-Routes                                        | 313                                                 | zu viel für Pre-Revenue          |
| Seiten                                            | 115                                                 | zu viel für Pre-Revenue          |
| Testdateien / Tests                               | 139 / 1.489                                         | gute Abdeckung                   |
| `tsc --noEmit`                                    | **0 Fehler**                                        | ✅                               |
| `next build`                                      | **Exit 0**, Compile 65 s                            | ✅                               |
| `vitest run`                                      | **17 rot** / 1.459 grün / 13 skipped, 5 Dateien rot | ❌                               |
| DB-Migrationen                                    | 155                                                 | Historie außer Kontrolle         |
| Tabellen mit RLS aktiv                            | 111 (alle mit ≥1 Policy)                            | ✅ Grundgerüst da                |
| `CREATE POLICY`-Statements auf `trainer_absences` | **24**                                              | Policy-Generationen stapeln sich |
| Routes über die `src/application`-Schicht         | 81 / 313 (26 %)                                     | Schichtmodell zu ¾ ungenutzt     |
| Mutierende Routes ohne Schema-Validierung         | **189 / 313 (60 %)**                                | ❌                               |
| Routes mit Rate-Limit                             | 171 / 313 (55 %)                                    | teilweise                        |
| `console.*`-Aufrufe (verstößt gegen eigene Regel) | 163 in 71 Dateien                                   | ❌                               |
| `any`-Verwendungen                                | 521                                                 | Typsicherheit erodiert           |
| `@ts-ignore`                                      | **0**                                               | ✅ vorbildlich                   |
| Leere `catch`-Blöcke                              | 1                                                   | ✅                               |
| TODO/FIXME im Produktivcode                       | 0 (6 in Tests)                                      | ✅                               |
| Tote Typdatei `supabase-types.ts`                 | 6.225 Zeilen, **0 Importe**                         | löschen                          |

### Was ausdrücklich in Ordnung ist

Damit der Aufwand nicht in bereits gelöste Probleme fließt — folgende Verdachtsmomente habe ich geprüft und **entlastet**:

- **Doppelbuchungsschutz existiert auf DB-Ebene.** `20260506200000_gist_booking_constraint.sql` setzt `EXCLUDE USING GIST (court_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE status NOT IN ('cancelled','rejected')`. Das ist die technisch korrekte Lösung — Race Conditions bei gleichzeitiger Buchung sind ausgeschlossen, unabhängig von der Anwendungslogik. Besser als bei vielen Wettbewerbern.
- **Keine toten Links, keine Aufrufe ins Leere.** Ich habe alle `fetch`/`apiFetch`-Ziele und alle internen `href`/`router.push`-Ziele gegen die real existierenden 313 Routes und 115 Seiten geprüft: **null echte Treffer** (die zwei Fundstellen sind Beispiele in Doc-Kommentaren). Die Verdrahtungs-Audits der Vorsessions haben gehalten.
- **Öffentliche Endpunkte sind korrekt geschützt.** Die 25 Routes ohne Login-Guard sind alle absichtlich offen und jeweils richtig abgesichert: Cron-Routes per `CRON_SECRET`, Stripe per Signaturprüfung, Zapier-/Booking-Webhooks per HMAC, alle `public/*`- und `auth/*`-Routes per Rate-Limit. Kein einziger versehentlich offener Endpunkt.
- **`/api/debug/auth` leakt nicht** — es gibt einen `NODE_ENV === 'production'` → 404 Guard. Trotzdem: löschen (siehe F-9).
- **Sentry ist installiert und verdrahtet** (`@sentry/nextjs`, `sentry.server.config.ts`, `sentry.client.config.ts`, angebunden in `lib/logger.ts` und `components/error-boundary.tsx`).
- **Die `USE_*_REPOSITORY`-Feature-Flags sind keine Fehlerquelle.** Sie existieren nur noch in zwei Integrationstests; kein Produktivcode liest sie. Also toter Ballast, kein doppelter Codepfad.

---

## 2. Die fünf Grundprobleme

Das sind die Ursachen. Alles in Abschnitt 3 ist Symptom.

### P1 — Zwei Datenzugriffs-Architekturen, davon eine ohne RLS

**Befund.** Zwei parallele Wege in dieselbe Datenbank:

| Pfad                                                           | Dateien | RLS                                               |
| -------------------------------------------------------------- | ------- | ------------------------------------------------- |
| Supabase-REST (`@/lib/supabase/*`)                             | 146     | aktiv (bzw. bewusst umgangen beim Service-Client) |
| Drizzle / postgres-js (`src/infrastructure/persistence/db.ts`) | 59      | **komplett umgangen**                             |

`DATABASE_URL` verbindet als `postgres.swingz` — die Tenant-Rolle des Supavisor-Poolers, also Tabellen-Eigentümer. PostgreSQL lässt Tabellen-Eigentümer RLS **standardmäßig ignorieren**, und `FORCE ROW LEVEL SECURITY` ist in **keiner** der 155 Migrationen gesetzt. Es gibt auch keine eingeschränkte App-Rolle (`CREATE ROLE`: keine).

**Konsequenz.** Für alle 59 Drizzle-Dateien — darunter die komplette Saisonplanung (28 Routes), Abrechnung (22 Routes) und Trainerverwaltung — sind die 111 mühsam gepflegten RLS-Policies **wirkungslos**. Ein vergessenes `.where(eq(x.clubId, clubId))` liefert Daten fremder Vereine aus. Das ist keine theoretische Lücke: 18 API-Dateien nutzen Service-Client bzw. Drizzle, ohne dass `club_id` überhaupt im File vorkommt.

Zusätzlich erklärt diese Spaltung das Symptom „funktioniert an vielen Stellen nicht": Der Drizzle-Pfad braucht eine direkte Postgres-Verbindung, die aus der Dev-Umgebung anders reagiert als aus Vercel (dokumentiert in `CLAUDE.md`, historisch belegt durch den SSL-/Pooler-Incident vom 21.07.). Der REST-Pfad hat dieses Problem nicht. Zwei Pfade = zwei Fehlerbilder = doppelte Diagnosezeit.

**Lösung — in dieser Reihenfolge:**

1. **Sofort (1 Tag, blockierend):** Eigene, nicht-privilegierte DB-Rolle anlegen und `DATABASE_URL` darauf umstellen; auf allen mandantenbehafteten Tabellen `ALTER TABLE … FORCE ROW LEVEL SECURITY`. Ab dann schlägt eine vergessene `club_id`-Bedingung als _leeres Ergebnis_ fehl statt als _Datenleck_. Das ist die höchste Sicherheitsrendite pro Aufwand im ganzen Projekt.
2. **Kurzfristig (2–3 Tage):** Ein Integrationstest, der als Verein A authentifiziert jede der 59 Drizzle-Routes aufruft und prüft, dass keine Zeile von Verein B zurückkommt. Ein Test, generisch über eine Routen-Liste — nicht 59 Einzeltests.
3. **Mittelfristig:** Genau **einen** Pfad wählen. Empfehlung: **Supabase-REST als Standard**, Drizzle nur dort behalten, wo es echte Transaktionen oder komplexes SQL braucht (Saison-Clustering, Abrechnungslauf). Kein Big-Bang-Rewrite — bei jeder Berührung einer Drizzle-Route wird sie migriert, sofern sie nicht transaktional ist.

### P2 — Unverschlüsselter DB-Transport

**Befund.** `src/infrastructure/persistence/db.ts` setzt `ssl: false`, mit Kommentar: der selbst gehostete Supavisor terminiert auf dem Pooler-Port kein TLS. Ziel ist `supabase.swingz.cloud:6543` — ein **externer Host über das öffentliche Internet**.

**Konsequenz.** Mitgliederstammdaten, Auth-Daten und SEPA-Mandate laufen im Klartext über fremde Netze. Das ist ein Hard-Blocker für den Verkauf: Art. 32 DSGVO verlangt Verschlüsselung bei der Übertragung, und der AVV, den Sie selbst unter `/avv` anbieten, ist damit nicht erfüllbar. Der erste Verein mit einem halbwegs kritischen Datenschutzbeauftragten fällt hier durch.

**Lösung (halber Tag, blockierend).** Nicht am Client herumdrehen, sondern die Infrastruktur richtig aufsetzen — eine von drei Varianten:

- TLS auf dem Supavisor-Port terminieren (nginx/Caddy davor, dann `ssl: 'require'` im Client), **oder**
- die DB-Verbindung ausschließlich über ein privates Netz / WireGuard führen und den Port aus dem Internet nehmen, **oder**
- den Drizzle-Pfad ganz aufgeben (siehe P1) — dann fällt das Problem mit weg, weil REST über HTTPS läuft.

Solange keine der drei Varianten steht, gilt: **kein Produktivkunde.**

### P3 — Das Geschäftsmodell ist im Code nicht durchgesetzt

**Befund.**

- Ein Abo-Status-Check existiert an **genau einer** Stelle: `app/(protected)/admin/(gated)/layout.tsx` (82 Zeilen). `proxy.ts`, `lib/admin-context.ts`, das Superadmin-Gated-Layout und **alle 313 API-Routes** prüfen ihn nicht.
- Konsequenz: Ein Verein, dessen Abo ausläuft, verliert eine Server-Seite — und benutzt die App über Trainer-/Mitglieder-Rollen und die API unverändert weiter.
- **Kein Self-Service-Kauf.** Weder `app/register/page.tsx` noch `app/api/auth/register/route.ts` noch die beiden Onboarding-Wizards (501 bzw. 512 Zeilen) berühren Stripe. Jeder Verkauf ist Handbetrieb.
- **Preisinkonsistenz mit Geldwirkung** in `lib/plans.ts`: `PLANS.solo_l.pricePerMonth = 49`, aber `PLAN_MONTHLY_PRICE.professional = 79` — bei identischem Label „Professional". Bestandskunden auf dem Legacy-Key sehen 79 €, das aktuelle Produkt kostet 49 €. `CLAUDE.md` behauptet ebenfalls 79 € und ist damit falsch.

**Lösung:**

1. **Abo-Gate zentralisieren (2 Tage).** Ein Check im Auth-Pfad, den alle Rollen und alle Routes durchlaufen: `requireActiveSubscription()` in `lib/api-auth.ts` und `lib/auth.ts`. Bei `past_due`/`canceled`: Lesezugriff bleibt, Schreibzugriff wird gesperrt (härtet das Modell, ohne einen Verein mitten in der Saison auszusperren — das ist die Variante, die Kunden nicht verbrennt).
2. **Self-Service-Kauf (3–5 Tage).** Onboarding-Wizard → Stripe Checkout → Webhook setzt `subscription_status`. Ohne diesen Pfad skaliert kein Verkauf, egal wie gut das Produkt ist.
3. **Preistabelle bereinigen (10 Minuten).** Eine Wahrheit: `lib/plans.ts`. Legacy-Keys darauf mappen, `PLAN_MONTHLY_PRICE` aus `PLANS` ableiten statt doppelt pflegen, `CLAUDE.md` korrigieren.

### P4 — Funktionsumfang ohne Nutzerbestätigung

**Befund.** 313 Routes / 115 Seiten. Gebaut und im Feature-Registry geführt: Shop mit Bestellungen und Coupons, Gamification mit Punkten und Badges, Apple-/Google-Wallet-Pässe, KI-Matchmaking, nuLiga-Scraper (cheerio), Familienkonten, Turniere, Arbeitsdienste, Newsletter-Kampagnen, Wetter-Platzsperren, QR-Check-in, Zapier-Webhooks, Push-Notifications, eine Entscheidungs-Seite, ein Swagger-UI. Zum Vergleich: tennis04 deckt den Markt seit 2004 mit deutlich weniger Software plus Hardware-Integration ab.

**Konsequenz.** Der Aufwand pro Änderung skaliert mit der Fläche, nicht mit dem Umsatz. 60 % der mutierenden Routes haben keine Eingabevalidierung, weil 313 Routes eben nicht mit derselben Sorgfalt entstehen können wie 60. Jede dieser Nebenfunktionen kostet Wartung, Migrationen, Testzeit und Support — und keine davon ist der Grund, warum ein Verein zahlt.

**Lösung.** Ehrliche Dreiteilung, und zwar hart:

- **V1-Kern (bleibt, wird poliert bis es glänzt):** Mitglieder, Platzbuchung, Saison-/Gruppenplanung, Abrechnung. Genau die vier, die `lib/features.ts` schon als `core` markiert — das Feature-Registry weiß es also bereits besser als die Codebasis.
- **V1.1 (bleibt aktiv, aber ohne Politur-Budget):** Arbeitsdienste, Turniere, Nachrichten/News, nuLiga/Ligen. Klassische Vereinsanforderungen, die im Verkaufsgespräch abgefragt werden.
- **Einfrieren (Feature-Flag standardmäßig aus, kein Support, kein Testbudget):** Shop, Gamification, Wallet-Pässe, KI-Matchmaking, Familienkonten, Zapier, Decisions, Design-Preview, Swagger-UI. Nicht löschen — das Feature-Flag-System dafür existiert schon. Nur: aus dem Sichtfeld und aus der Verantwortung nehmen.

### P5 — Migrations- und Policy-Historie außer Kontrolle

**Befund.** 155 Migrationen ohne Tracking-Tabelle (bereits in `AGENTS.md` dokumentiert, hier quantifiziert): `trainer_absences` hat **24** `CREATE POLICY`-Statements über die Historie, `attendance_records` 19, `trial_trainings` 15, `clubs` 14, `user_club_memberships` 14, `bookings` 13. Da RLS mehrere Policies mit **OR** verknüpft, ist eine zu viel gelassene Alt-Policy eine stille Rechteerweiterung.

**Konsequenz.** Niemand kann sagen, welche Rechte in der Live-DB tatsächlich gelten. Das ist ein Sicherheits*audit*-Problem, nicht nur ein Hygieneproblem: Sie können einem Interessenten die Mandantentrennung nicht belegen.

**Lösung (2–3 Tage, einmalig).**

1. Ist-Zustand aus `pg_policies` der Live-DB exportieren — nicht aus den Dateien ableiten.
2. **Eine** konsolidierende Migration schreiben, die pro Tabelle alles per `DROP POLICY IF EXISTS <exakter Live-Name>` abräumt und genau einen sauberen Policy-Satz neu anlegt.
3. Diesen Ist-Zustand als Baseline in `docs/DATABASE.md` festschreiben und ab dann `supabase_migrations.schema_migrations` als Tracking führen.
4. CI-Guard: ein Test, der scheitert, wenn eine mandantenbehaftete Tabelle mehr als _n_ Policies pro Operation hat.

---

## 3. Konkrete Fehler und Auffälligkeiten

Sortiert nach Ertrag pro Aufwand.

| #       | Befund                                                                                                                          | Beweis                                                                                                                                                                              | Lösung                                                                                                                                                                                                                                                                  | Aufwand                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **F-1** | 17 rote Unit-Tests                                                                                                              | `vitest run`: 5 Dateien rot                                                                                                                                                         | s. F-1a/F-1b                                                                                                                                                                                                                                                            | 1 Tag                  |
| F-1a    | `PUT /api/branding` antwortet **400 statt 200** für gültige Payloads                                                            | `tests/unit/api/branding.test.ts`, beide Fälle                                                                                                                                      | Allowlist/Zod-Schema in `app/api/branding/route.ts` gegen den tatsächlichen Payload prüfen — Vereins-Branding ist ein Verkaufsargument und aktuell defekt                                                                                                               | 2 h                    |
| F-1b    | Clustering-Tests brechen mit `invalid input syntax for type uuid: "c1"`                                                         | `src/__tests__/lib/clustering-engine.test.ts:530`, `:1336` über `clustering-engine.ts:839`                                                                                          | Test-Fixtures nutzen `"c1"` statt UUID. **Aber**: der Test deckt den Fall „ungültige Club-ID" ab, den die Engine nicht abfängt — Fixtures auf UUIDs umstellen _und_ Eingabevalidierung in `loadGroups` ergänzen                                                         | 3 h                    |
| **F-2** | **189 von 313 mutierenden Routes ohne Eingabevalidierung**                                                                      | Scan auf `safeParse`/`.parse(` in Routes mit POST/PUT/PATCH/DELETE                                                                                                                  | Zod ist installiert und in `src/application/validation/schemas.ts` bereits etabliert. Nicht 189 Schemas von Hand: `withApiAuth` um einen optionalen `schema`-Parameter erweitern, dann Route für Route beim Anfassen nachziehen. Priorität: die ~40 Routes des V1-Kerns | 5–8 Tage, inkrementell |
| **F-3** | 163 `console.*`-Aufrufe in 71 Dateien — verstößt gegen die eigene Regel und umgeht Sentry                                       | Worst: `hourly-rate.repository.ts` (18), `trainer-profile.repository.ts` (17), `season-billing.service.ts` (9)                                                                      | ESLint-Regel `no-console` als **error** (nicht warn) + Durchlauf auf `createLogger`. Ohne die Regel kommt es zurück                                                                                                                                                     | 3 h                    |
| **F-4** | `supabase-types.ts` — 6.225 Zeilen, **0 Importe**; parallel existiert `types/supabase.ts` (7.314 Zeilen, 10 Importe)            | Import-Scan über alle 1.356 Dateien                                                                                                                                                 | Löschen. `gen:types` prüfen, dass nur ein Ziel erzeugt wird                                                                                                                                                                                                             | 15 min                 |
| **F-5** | 521 `any` — konzentriert in genau den Routes, die keine Validierung haben                                                       | Worst: `family-accounts/route.ts` (16), `leagues/[id]/route.ts` (12), `leagues/[id]/sync/route.ts` (11)                                                                             | Fällt bei F-2 als Nebenprodukt weg: Zod-Schema ⇒ inferierter Typ ⇒ `any` verschwindet. Kein separates Projekt                                                                                                                                                           | mit F-2                |
| **F-6** | **Alle 115 Seiten sind `ƒ` (dynamisch)** — inkl. `/landing`, `/impressum`, `/datenschutz`, `/terms`, `/about`                   | `next build`-Ausgabe: nur `/sitemap.xml` ist `○`                                                                                                                                    | Statische Seiten statisch rendern. Betrifft SEO (die Landingpage ist Ihr Vertriebskanal), TTFB und Vercel-Kosten                                                                                                                                                        | 1 Tag                  |
| **F-7** | `unified-court-calendar.tsx` 2.784 Zeilen, `clustering-engine.ts` 2.655, `trainer-detail-client.tsx` 1.676                      | Zeilenzählung                                                                                                                                                                       | Nicht aus Prinzip aufteilen. **Nur** den Kalender: er ist die Komponente, die jedes Mitglied täglich sieht, und 2.784 Zeilen in einer Client-Komponente sind ein Performance- und Bugrisiko auf Mobilgeräten                                                            | 2–3 Tage               |
| **F-8** | 142 Routes ohne Rate-Limit                                                                                                      | 171/313 haben eines                                                                                                                                                                 | Für authentifizierte Routes weniger kritisch. Nachziehen bei allen Routes, die E-Mails senden, Dateien schreiben oder KI aufrufen                                                                                                                                       | 1 Tag                  |
| **F-9** | `/api/debug/auth` (Prod-Guard vorhanden, aber toter Debug-Code) und 6 Client-Komponenten mit nacktem `fetch()` statt `apiFetch` | `reports-dashboard.tsx`, `customizable-dashboard.tsx`, `gamification-dashboard.tsx`, `app/register/page.tsx`, `app/join/[clubId]/page.tsx`, `app/(protected)/shop/success/page.tsx` | Debug-Route löschen. `fetch` → `apiFetch` (die zwei in `register`/`join` zuerst — das ist der Registrierungsweg)                                                                                                                                                        | 2 h                    |
| F-10    | 11 tote `USE_*_REPOSITORY`-Env-Variablen + 2 Tests, die einen nicht mehr existierenden Mechanismus prüfen                       | Nur in `src/__tests__/integration/feature-flags.test.ts`, `service-migration.test.ts`                                                                                               | Beides löschen, Env-Variablen aus `.env.local` und der Doku                                                                                                                                                                                                             | 30 min                 |
| F-11    | 1 leerer `catch`-Block                                                                                                          | `app/layout.tsx`                                                                                                                                                                    | Kommentar warum, oder loggen                                                                                                                                                                                                                                            | 5 min                  |

---

## 4. Der Markt, konkret

| Produkt             | Modell / Preis                                                                        | Stärken                                                                                                                                                         | Lücke                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **tennify**         | **Komplett kostenlos**, werbefinanziert (Werbefreiheit per In-App-Abo)                | Platzbuchung, News + Push, Arbeitsdienste, Ligaspiele, Mitglieder, Rollen. Alles ohne Limit bei Plätzen/Mitgliedern                                             | Keine Trainer-/Saisonplanung, keine Abrechnung, kein Tennisschul-Mehrmandanten-Modell |
| **tennis04**        | ~10 €/Platz/Monat (6 Plätze ≈ 60 €/Mon.), Module extra                                | Marktführer seit 2004, PWA, **Hardware**: Flutlicht, Zutritt, Touch-Terminal, Kiosk, Clubkarten, Kassenschnittstelle, offene API. Abo-Planer für Dauerbuchungen | Hardware-Fokus, keine automatische Gruppenbildung nach Spielstärke/Verfügbarkeit      |
| **courtbooking.de** | Module: Vereinsverwaltung, Beitragsabwicklung                                         | Etabliert, breit                                                                                                                                                | —                                                                                     |
| **Platzbuchung.de** | Vereinsapp + Buchung                                                                  | Flexible Gruppenrechte, konfigurierbare Buchungsregeln                                                                                                          | —                                                                                     |
| **SwingZ**          | 29 € (bis 200 Mitgl.) / 49 € (ab 201) / 79 € (Tennisschule bis 5 Vereine) / 99 € (>5) | Saisonplanung mit automatischem Clustering, Mehrmandanten-Tennisschule, Trainerabrechnung inkl. SEPA, DB-seitiger Doppelbuchungsschutz                          | Kein Kunde, kein Self-Service-Kauf, Fundament offen                                   |

**Die unbequeme Schlussfolgerung.** Als Platzbuchungssystem ist SwingZ nicht verkäuflich: tennify liefert Buchung + News + Arbeitsdienste + Ligen für **0 €**, tennis04 liefert Buchung + Hardware mit 22 Jahren Referenzen. Gegen „kostenlos" gewinnt man nicht mit „aber schöner", und gegen 22 Jahre Marktpräsenz nicht mit mehr Features.

Quellen: [SchlägerClub Vergleich](https://schlaegerclub.de/tennisclub/tennisplatz-buchungssysteme-vergleich), [tennis04](https://www.tennis04.com/produkte/), [tennify](https://tennify.de/), [courtbooking.de](https://courtbooking.de/platzbuchungssystem-tennis.php), [Platzbuchung.de](https://platzbuchung.de/branchen/tennis-vereins-app)

---

## 5. Positionierung: wo SwingZ tatsächlich gewinnt

Es gibt genau eine Lücke, und SwingZ steht schon mittendrin, ohne es im Marketing zu nutzen:

> **Kein Wettbewerber löst die Trainingsgruppen-Planung.**

Das ist der Vorgang, der jede Tennisschule und jeden Verein mit Trainingsbetrieb zweimal jährlich mehrere Tage kostet: 120 Mitglieder mit Spielstärke, Altersklasse und Verfügbarkeitswünschen auf Trainer, Plätze und Zeitfenster verteilen, dann Wartelisten, Abwesenheiten, Vertretungen und Abrechnung nachziehen. Heute passiert das in Excel und WhatsApp. tennis04 hat einen Abo-Planer für _Dauerbuchungen_ — das ist Kalenderverwaltung, keine Optimierung. tennify hat dazu gar nichts.

SwingZ hat dafür eine 2.655-Zeilen-Clustering-Engine mit Dry-Run, Präferenzerfassung, Wartelisten, Vertretungsplanung und Konflikterkennung. **Das ist das Produkt.** Platzbuchung ist die Pflichtbeilage, die man mitliefern muss, um überhaupt eingekauft zu werden — nicht das Verkaufsargument.

**Daraus folgt für die Vermarktung:**

- Zielkunde ist nicht „Tennisverein", sondern **Tennisschule und Verein mit eigenem Trainingsbetrieb** (ab ~4 Trainern). Diese Zielgruppe hat Zahlungsbereitschaft, weil ihr Schmerz in Arbeitstagen messbar ist — und sie ist genau die Zielgruppe, für die die 79/99-€-Tarife gebaut sind.
- Der Aufhänger im Verkaufsgespräch ist ein einziger Satz: _„Ihre Saisonplanung in 20 Minuten statt in drei Tagen."_
- Das rechtfertigt einen Preis **über** tennis04, weil eingesparte Arbeitstage gegengerechnet werden, nicht Plätze.
- Die kostenlose Konkurrenz wird damit irrelevant: tennify löst dieses Problem nicht, also ist der Vergleich kein Preisvergleich mehr.
- Die Nebenfunktionen tragen zu dieser Geschichte **nichts** bei. Das ist der stärkste Grund für P4.

---

## 6. Definition von „verkaufsfähig"

Checkliste. Alles davon muss stehen, sonst verkauft man ein Haftungsrisiko.

**Blockierend (kein Kunde davor)**

- [ ] DB-Transport verschlüsselt (P2)
- [ ] Nicht-privilegierte DB-Rolle + `FORCE ROW LEVEL SECURITY` (P1.1)
- [ ] Automatisierter Mandantentrennungs-Test grün (P1.2)
- [ ] Konsolidierte, dokumentierte RLS-Policies (P5)
- [ ] Testsuite grün (F-1)
- [ ] AVV inhaltlich erfüllbar, Löschkonzept vorhanden (`/api/user/delete` existiert — Wirksamkeit über alle 111 Tabellen prüfen)

**Für den ersten zahlenden Kunden**

- [ ] Abo-Gate zentral, für alle Rollen und Routes (P3.1)
- [ ] Self-Service: Registrierung → Checkout → aktives Abo ohne Handbetrieb (P3.2)
- [ ] Eingabevalidierung auf den ~40 Kern-Routes (F-2)
- [ ] Branding-Bug behoben (F-1a) — Vereinslogo/Farben sind ein Kaufargument
- [ ] Ein Referenzverein hat eine echte Saison durchgeplant und abgerechnet
- [ ] Datenimport aus Excel/nuLiga dokumentiert und getestet (`bulk-import` existiert)

**Für den zehnten Kunden**

- [ ] Kernkalender performant auf Mobilgeräten (F-7)
- [ ] Statische Seiten statisch (F-6)
- [ ] Nebenfunktionen per Flag aus, Support-Fläche verengt (P4)
- [ ] Onboarding, das ein Verein ohne Sie schafft

---

## 7. Reihenfolge

| Phase                          | Dauer       | Inhalt                                        | Ergebnis                                        |
| ------------------------------ | ----------- | --------------------------------------------- | ----------------------------------------------- |
| **1 — Fundament abdichten**    | ~1 Woche    | P2, P1.1, P1.2, F-1, F-4, F-10, F-11          | Die App ist verkaufbar, ohne fahrlässig zu sein |
| **2 — Geschäftsmodell scharf** | ~1,5 Wochen | P3.1, P3.2, F-1a, Preise vereinheitlichen     | Ein Verein kann selbst kaufen und bezahlen      |
| **3 — Fläche verengen**        | ~1 Woche    | P4-Dreiteilung, P5-Konsolidierung, F-3, F-9   | Wartungslast halbiert, Rechtelage belegbar      |
| **4 — Kern polieren**          | ~2 Wochen   | F-2 auf Kern-Routes, F-6, F-7, Onboarding-Weg | Vorzeigbar in einem Verkaufsgespräch            |

**Parallel und ab sofort wichtiger als jede dieser Phasen:** ein Referenzverein, der die Saisonplanung produktiv nutzt. Ein echter Nutzer ordnet die Prioritäten in wenigen Tagen besser, als jedes Audit es kann — dieses eingeschlossen.

---

## 8. Was ich nicht geprüft habe

Damit keine falsche Sicherheit entsteht:

- **Kein Klickthrough im Browser.** Alle Aussagen zur Laufzeit sind aus Code, Build und Tests abgeleitet. Symptome, die nur bei echten Daten auftreten (Zeitzonen, Sommerzeitwechsel in der Saisonplanung, Stripe-Webhook-Reihenfolge), sind hier nicht erfasst.
- **Keine Live-DB-Abfrage.** Der Policy-Wildwuchs ist aus den Migrationsdateien gezählt, nicht aus `pg_policies`. Der Live-Zustand kann besser _oder schlechter_ sein — das ist genau der Grund für P5.
- **Keine E2E-Testläufe.** Braucht einen laufenden Dev-Server; auf dieser Maschine RAM-kritisch.
- **Kein Lasttest.** Unbekannt, wie sich die Clustering-Engine bei 500 Mitgliedern verhält.
