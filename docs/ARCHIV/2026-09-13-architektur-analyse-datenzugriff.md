# Architektur-Analyse Datenzugriff — 13.09.2026

> Snapshot (Archiv). Grundlage für eine Architektur-Entscheidung, die danach als
> `docs/decisions/adr-005-…` festgehalten wird. Methodik und Zahlen: § 8.
> Vorarbeiten, auf denen diese Analyse aufbaut: `2026-07-26-produktaudit-verkaufsreife.md` (P1),
> `2026-07-26-produktaudit-phase1-umsetzung.md`, `decisions/adr-004-netzzugang-vps.md`,
> `DATABASE.md` § FORCE RLS.

---

## 1. Kurzfazit

1. **SwingZ hat nicht zwei, sondern drei Wege zur Datenbank.** Zwei davon umgehen die
   Mandantentrennung der Datenbank (RLS). Etwa **die Hälfte der API** verlässt sich darauf, dass
   jede einzelne Abfrage im Anwendungscode korrekt nach `club_id` filtert. Im Juli wurden genau
   dort zwei echte Datenlecks zwischen Vereinen gefunden.
2. **Die Schichten-Architektur in `src/` ist halb eingeführt.** Das Gerüst ist vollständig
   (Entities, Repository-Interfaces, Repositories, Services, Adapter, Use-Cases, DI-Container),
   aber es ist nicht der Standard. Der DI-Container wird nie gestartet, und die Hälfte der
   Services existiert doppelt (Service + Adapter). Innerhalb der Schicht werden zudem zwei
   Datenbank-Technologien gemischt.
3. **„Professionell“ heißt hier nicht „Drizzle“, sondern ein einziger, geprüfter Weg:**
   Route → Service → Repository → Datenbank mit RLS. Schichtung und Datenbank-Technologie sind
   zwei getrennte Fragen. Die Schichtung bleibt und wird Pflicht. Die Technologie ist die
   Entscheidung, die zu treffen ist (§ 5).
4. **Empfehlung:** Schichten-Architektur als verbindlicher Standard, Datenzugriff in den
   Repositories über den **Supabase-Client mit Nutzer-Token** (Option B). Die Alternative
   Drizzle mit RLS (Option A) ist sauber machbar, setzt aber zuerst eine Infrastruktur-Änderung
   voraus (verschlüsselte, nicht öffentliche DB-Verbindung).
5. **Aufwand:** etwa 7–9 Wochen Vollzeit, schrittweise Domäne für Domäne, ohne Big-Bang und
   ohne Funktionsstopp.

> **Korrektur zur mündlichen Einschätzung vom selben Tag:** Dort hieß es, nur 26 Routes nutzten
> die Schichten bzw. Drizzle. Das war eine Unterzählung (Import-Alias `@/infrastructure` und
> transitive Importe über `lib/` nicht erfasst). Richtig sind **~85 Routes** (§ 3). Die
> Empfehlung „Schichten zurückbauen“ ist damit ebenfalls überholt. Zurückgebaut wird nur die
> Zeremonie (DI-Container, Doppel-Adapter), nicht die Schichtung.

---

## 2. Was „Drizzle“ und „Supabase“ hier bedeuten

Beide sprechen mit **derselben** PostgreSQL-Datenbank. Der Unterschied ist, **wie** und **als wer**.

```
                          ┌─────────────── VPS (self-hosted Supabase) ───────────────┐
 Weg 1  Supabase-Client   │                                                          │
 (Nutzer-Token)  ──HTTPS──▶ Kong/PostgREST ──▶ Postgres als "authenticated"          │
                          │                    └─ RLS aktiv: sieht nur eigenen Verein │
 Weg 2  Service-Client    │                                                          │
 (service_role)  ──HTTPS──▶ Kong/PostgREST ──▶ Postgres als "service_role"           │
                          │                    └─ BYPASSRLS: sieht alles              │
 Weg 3  Drizzle           │                                                          │
 (postgres-js)   ──TCP────▶ Supavisor :6543 ──▶ Postgres als "postgres"              │
          öffentlich, ohne TLS                   └─ BYPASSRLS: sieht alles            │
                          └──────────────────────────────────────────────────────────┘
```

|                   | Weg 1: Supabase-Client (Nutzer)  | Weg 2: Service-Client     | Weg 3: Drizzle                                                                                                            |
| ----------------- | -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Datei             | `lib/supabase/server.ts`         | `lib/supabase/service.ts` | `src/infrastructure/persistence/db.ts`                                                                                    |
| Transport         | HTTPS                            | HTTPS                     | TCP auf öffentlichem Port 6543, **ohne TLS** (Default `DATABASE_SSL` ≠ `require`, siehe Kommentar in `db.ts` und ADR-004) |
| Datenbank-Rolle   | `authenticated` (aus dem JWT)    | `service_role`            | `postgres` (Tabelleneigentümer)                                                                                           |
| Mandantentrennung | **Datenbank erzwingt sie** (RLS) | nur Anwendungscode        | nur Anwendungscode                                                                                                        |
| Transaktionen     | nur über SQL-Funktionen (`rpc`)  | nur über SQL-Funktionen   | ja, direkt (`db.transaction`)                                                                                             |
| Typen             | generiert: `types/supabase.ts`   | generiert                 | handgepflegt: `schema.ts` (2.964 Zeilen)                                                                                  |

**Die entscheidende Eigenschaft ist die Zeile „Mandantentrennung“.** Bei Weg 1 kann ein
vergessenes `.eq('club_id', …)` keine fremden Daten ausliefern, weil die Datenbank selbst filtert.
Bei Weg 2 und 3 liefert derselbe Fehler Daten eines anderen Vereins aus. Die 114 RLS-Policies
wirken für diese Wege nicht (`DATABASE.md`: `postgres` und `service_role` haben
`rolbypassrls = true`).

**Und die Schichten?** Die Ordner `src/domain`, `src/application`, `src/infrastructure` sind ein
_Organisationsprinzip_ („Clean Architecture“): Fachlogik in Services, Datenzugriff gekapselt in
Repositories. Das ist unabhängig von der Technologie. Ein Repository kann intern Drizzle oder den
Supabase-Client benutzen. Dass die Schichten heute größtenteils mit Drizzle gebaut sind, ist
historisch so gewachsen und keine Notwendigkeit.

---

## 3. Ist-Zustand in Zahlen

### 3.1 Datenzugriff der 321 API-Routes

| Weg                                                                   | Routes                                 | RLS wirksam    |
| --------------------------------------------------------------------- | -------------------------------------- | -------------- |
| Drizzle (direkt oder transitiv über Services/`lib/`)                  | **~85**                                | nein           |
| Service-Client (direkt im Route-File)                                 | **86** (teils überlappend mit Drizzle) | nein           |
| Weder noch (Nutzer-Client, teils indirekt Service-Client über `lib/`) | ~157                                   | überwiegend ja |

Dazu 8 Seiten/Layouts, die Drizzle nutzen, und 25 `lib/`-Module mit Service-Client.
Drizzle-Schwerpunkte: Saisonplanung (23 Routes), Trainer, Stundensätze, Anwesenheit,
Probetraining, Abwesenheiten, Gruppen, Preise. Dazu **SEPA-Mandate** (`sepa-mandate.service.ts`):
IBANs laufen damit über die unverschlüsselte Verbindung.

### 3.2 Zustand der Schichten-Architektur

| Baustein                                                                  | Befund                                                                                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| DI-Container `src/application/container.ts` (tsyringe + reflect-metadata) | registriert 10 Tokens, **`registerServices()` wird nirgends aufgerufen**, `container.resolve` kommt nicht vor → toter Code                         |
| Use-Cases (3 Dateien)                                                     | `booking.use-cases` ist `@injectable` und wird nie aufgelöst. Die beiden anderen nutzt je eine Route.                                              |
| Services + Adapter                                                        | 11 `*-service.adapter.ts` neben `*.service.ts`: zwei Klassen je Domäne für dieselbe Aufgabe                                                        |
| Repository-Interfaces (20)                                                | jeweils genau eine Implementierung → kein Nutzen, doppelte Pflege                                                                                  |
| Technologie innerhalb der Schicht                                         | `billing.service.ts`, `member.service.ts` nutzen Service-Client, die übrigen Drizzle                                                               |
| Echte Transaktionen                                                       | nur **9** Stellen im gesamten Code (`db.transaction`)                                                                                              |
| Typquellen                                                                | **drei**: `schema.ts` (Drizzle, handgepflegt), `types/supabase.ts` (generiert), 18 Entities + 7 `lib/types` mit handgeschriebenen `rowToX`-Mappern |

### 3.3 Routes selbst

| Befund                                                                             | Zahl                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Routes mit `withApiAuth`                                                           | 278 von 321 ✅                                                 |
| Routes > 200 Zeilen (Fachlogik direkt im Handler)                                  | 54                                                             |
| Schreibende Routes (POST/PUT/PATCH) ohne erkennbare Schema-Validierung (Zod o. ä.) | 156 von 221 (Heuristik, manuelle `if`-Prüfungen nicht erfasst) |
| Doppelter Code (jscpd)                                                             | 2,2 % ✅                                                       |

---

## 4. Bewertung: Logik und Professionalität

### Was bereits professionell ist

- Zentrale Authentifizierung (`withApiAuth`, `AuthContext` mit Rolle, Club, Memberships) fast überall.
- RLS auf allen Tabellen, konsolidierte Policies, Baseline-Migration, Migrations-Tracking (ADR-002).
- Strukturiertes Logging, Abo-Gate auf API-Ebene, sehr umfangreiche Tests, geringe Duplikation.
- Dokumentierte Entscheidungen (ADRs) und maschinell geprüfte Doku-Regeln.

Die Basis ist gut. Die Probleme liegen in der **Uneinheitlichkeit**, nicht in der Qualität der
einzelnen Teile.

### P0: Mandantentrennung hängt an Handarbeit

Etwa die Hälfte der API umgeht RLS. Jede Abfrage muss dort selbst korrekt filtern. Das ist
nicht theoretisch: Im Juli wurden zwei reale Lecks gefunden
(`seasons/[id]/…`, `preferences/[userId]`), die Absicherung besteht aus einem Test für die
Season-Routes (`season-tenant-isolation.test.ts`). Für ein Produkt, das Vereinen Mitgliederdaten,
Rechnungen und IBANs anvertraut, ist ein Leck zwischen Mandanten der schwerste denkbare Fehler
(DSGVO-Meldepflicht, Vertrauensverlust).

### P0: Unverschlüsselter, öffentlicher Datenbankzugang

Weg 3 läuft über einen öffentlichen Port ohne TLS, inklusive Passwort im Startpaket
(ADR-004 hält das bewusst als „Phase vor dem ersten zahlenden Verein“ fest). Mit echten Kunden
ist das nicht mehr vertretbar. Solange Drizzle zur Laufzeit gebraucht wird, lässt sich der Port
nicht schließen.

### P1: Halbe Architektur erzeugt Logikfehler

Unbenutzte oder parallele Pfade veralten unbemerkt. Belegte Fälle:

- `DrizzleMemberRepository` las und schrieb gegen die leere Tabelle `club_members`.
  Mitgliederlisten waren leer, neue Mitgliedschaften gingen verloren (`DATABASE.md`).
- Statistik-Fix am falschen Pfad: Die Korrektur lag in `calculateMemberStatistics()`, der Test
  prüfte `getDashboardMetrics()` über eine Route, die kein Frontend nutzt
  (`2026-09-03-projektanalyse-folgeanalyse.md` § 3.1).
- Tests mockten Drizzle, während die Clustering-Engine über den Service-Client lief. Der Test
  griff dadurch live auf die DB zu (Phase-1-Bericht).

Wer eine Funktion ändern will, muss heute erst herausfinden, _welcher_ von bis zu drei Wegen
gilt. Das kostet Zeit und produziert genau diese Fehler.

### P1: Drei Typquellen

`schema.ts`, `types/supabase.ts` und die Entities beschreiben dieselben Tabellen. Die
Migrationen (SQL) sind die eigentliche Wahrheit, alles andere wird von Hand nachgezogen. Eine
Spalte, die in einer Quelle fehlt oder anders heißt, fällt erst zur Laufzeit auf.

### P1: Fachlogik und Validierung in den Routes

54 Routes mit über 200 Zeilen enthalten Geschäftslogik direkt im HTTP-Handler (z. B.
`seasons/[id]/planning/confirm` mit 676 Zeilen). Das ist nicht wiederverwendbar (Cron, Webhook
und UI brauchen dieselbe Logik) und schwer zu testen. Eingabevalidierung ist uneinheitlich.

### P2: Zeremonie ohne Nutzen

DI-Container mit Symbol-Tokens, ein Interface pro Repository mit genau einer Implementierung,
Service plus Adapter: Das sind Muster aus Java/.NET-Enterprise-Projekten. In TypeScript/Next.js
machen sie den Code nicht professioneller. Sie erhöhen die Zahl der Dateien pro Änderung von
2 auf 5. Testbarkeit erreicht man hier mit Modul-Importen und `vi.mock`.

### P2: Verstreute Zuständigkeiten

- E-Mail: drei Services (`src/application/services/email.service.ts` mit 1.578 Zeilen,
  `src/infrastructure/email/email.service.ts`, Saisonplanungs-Mails).
- Abrechnung: `lib/billing-engine.ts`, `lib/billing/`, `lib/services/billing.service.ts`
  (Mitgliederrechnungen), `src/application/services/billing.service.ts` samt Adapter
  (Trainerabrechnung). Das sind fachlich unterschiedliche Dinge, aber ohne erkennbare Heimat.

---

## 5. Zielbild und Technologie-Entscheidung

### 5.1 Zielbild (unabhängig von der Technologie)

```
app/api/**/route.ts        dünn: withApiAuth → Zod-Validierung → service-Aufruf → HTTP-Antwort
        │
src/application/<domäne>/  Fachlogik, ein Modul pro Domäne, kennt keine HTTP-Details
        │
src/infrastructure/<domäne>/  Repository: einziger Ort mit Datenbankzugriff
        │
Postgres mit RLS           Mandantentrennung wird hier erzwungen
```

Verbindliche Regeln (werden maschinell geprüft, siehe § 7):

1. Routes und Seiten greifen **nie** direkt auf die Datenbank zu, nur über Services.
2. Repositories bekommen den Datenbank-Kontext **pro Request mit Nutzer-Identität**
   (`getUserDb(auth)`). RLS greift immer.
3. Zugriff ohne RLS (`systemDb()`) nur an einer **Whitelist** von Systempfaden: Cron,
   Stripe-Webhook, Benachrichtigungen, Owner-Funktionen. Jede Nutzung ist begründet.
4. **Eine Typquelle:** aus den SQL-Migrationen generierte Typen. Domänen-Typen leiten sich davon ab.
5. Jede schreibende Route validiert ihre Eingabe mit Zod (in `withApiAuth` integriert).
6. Kein DI-Container, keine Interfaces mit genau einer Implementierung, keine Adapter-Doppel.

### 5.2 Option A: Drizzle mit RLS

Drizzle unterstützt RLS für Supabase offiziell. Jede Anfrage läuft in einer Transaktion, die
`set_config('request.jwt.claims', …)` setzt und auf die Rolle `authenticated` wechselt. Damit
greifen die bestehenden Policies auch für Drizzle.

| Pro                                              | Contra                                                                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typsichere Abfragen, auch komplexe Joins und SQL | **Voraussetzung Infrastruktur:** TLS am Pooler und nicht-öffentliche Verbindung. Das geht nur mit App auf dem VPS oder Managed Supabase (ADR-004, offener Endzustand). |
| Echte Transaktionen im Code                      | Jede Anfrage wird zur Transaktion (Latenz, Pooler-Last bei Serverless)                                                                                                 |
| Bestehende Drizzle-Repositories bleiben nutzbar  | ~157 Supabase-Client-Routes müssen umziehen (die größere Hälfte)                                                                                                       |
|                                                  | Zweite Schemaquelle `schema.ts` bleibt handgepflegt neben den SQL-Migrationen                                                                                          |
|                                                  | Neue DB-Rolle ohne BYPASSRLS nötig, Fehler dort legen Prod lahm (Phase-1-Bericht)                                                                                      |

### 5.3 Option B: Supabase-Client in Repositories (Empfehlung)

Die Repositories kapseln den Supabase-Client, dem das Nutzer-Token des Requests mitgegeben wird.

| Pro                                                                                                                                       | Contra                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| RLS greift automatisch, ohne Zusatzkonstrukt                                                                                              | Die 9 Transaktionen werden zu SQL-Funktionen (`rpc`), das sind 82 bereits vorhandene Beispiele im Schema         |
| HTTPS. Nach der Migration kann **Port 6543 geschlossen** werden, damit ist das P0-Transportproblem erledigt, ohne Umzug der Infrastruktur | Sehr komplexe Abfragen (Clustering, Konfliktprüfung) werden als SQL-Views/Funktionen formuliert statt im TS-Code |
| Eine Typquelle: `supabase gen types` aus den Migrationen                                                                                  | Weniger „ORM-Komfort“ als Drizzle                                                                                |
| Entspricht dem Weg, den ~60 % des Codes schon gehen: kleinerer Umbau                                                                      |                                                                                                                  |
| Die Supabase-Skills im Projekt (`.claude/skills/supabase*`) decken genau dieses Muster ab                                                 |                                                                                                                  |

### 5.4 Warum B

Beide Optionen erreichen dasselbe Zielbild. B erreicht es mit weniger Risiko:

- Es löst **beide P0-Probleme** (RLS und unverschlüsselter Port) innerhalb des Codes, ohne
  vorher die Hosting-Frage entscheiden zu müssen.
- Es entfernt eine Schemaquelle, statt eine zu behalten.
- Es verschiebt den kleineren Teil des Codes.

A ist die richtige Wahl, **wenn** ohnehin feststeht, dass die App auf den VPS zieht oder auf
Managed Supabase gewechselt wird, und das Team komplexe Abfragen lieber in TypeScript als in SQL
schreibt. Dann zuerst diese Infrastruktur-Entscheidung treffen (eigene ADR), danach A umsetzen.

**→ Entscheidung durch den Produktverantwortlichen, danach ADR-005.**

---

## 6. Umsetzungsplan (für Option B)

Jede Phase ist einzeln mergebar (AGENTS.md § Auslieferung: kein Branch älter als eine Woche).

### Phase 0: Entscheidung und Sicherheitsnetz (2–3 Tage)

- [ ] Option A/B entscheiden, **ADR-005** schreiben (inkl. verworfener Alternative).
- [ ] **Generischer Mandanten-Isolationstest:** `season-tenant-isolation.test.ts` auf alle Routes
      ausweiten. Als Admin von Claude Sandbox Alpha jede GET-Route mit IDs aus Sandbox Beta
      aufrufen, es darf keine fremde Zeile zurückkommen. Das ist das Sicherheitsnetz für alles
      Weitere.
- [ ] **Architekturregeln als Check** (dependency-cruiser, § 7) im Modus „nur melden“ mit
      Baseline der heutigen Verstöße. Neue Verstöße brechen den Build, alte werden abgebaut.
- **Fertig, wenn:** ADR gemergt, Isolationstest grün in CI, Architektur-Check läuft im pre-commit.

### Phase 1: Zeremonie entfernen (2–3 Tage)

- [ ] `container.ts`, `tsyringe`, `reflect-metadata` entfernen, `booking.use-cases` löschen.
- [ ] Knip-Befunde abarbeiten (62 Exporte, 18 Typen, 7 Duplikate).
- [ ] `/api/statistics/dashboard` anbinden oder löschen (Folgeanalyse § 4.3).
- **Fertig, wenn:** `npm run knip` sauber, `tsc`, `vitest` grün.

### Phase 2: Fundament und Referenzdomäne (1 Woche)

- [ ] `src/infrastructure/db/`: `getUserDb(auth)` (Supabase-Client mit Nutzer-Token) und
      `systemDb(reason)` (Service-Client, Whitelist per Lint-Regel).
- [ ] `withApiAuth` um optionales Zod-Schema erweitern: `withApiAuth({ body: schema }, handler)`.
- [ ] Einheitliche Fehlerabbildung Repository → Service → deutsche HTTP-Meldung (auf
      `lib/api-error.ts` aufbauen).
- [ ] Domänen-Typen aus `types/supabase.ts` ableiten (`Tables<'x'>`), keine Handmapper mehr.
- [ ] **Referenzdomäne komplett umbauen:** Stundensätze (`hourly-rates`, 5 Routes, klein,
      heute Drizzle + Service + Adapter). Ergebnis ist die Vorlage für alle weiteren Domänen,
      inklusive Teststruktur.
- [ ] Muster in `CLAUDE.md` § Architektur dokumentieren (ersetzt die Supabase-Client-Tabelle).
- **Fertig, wenn:** Referenzdomäne ohne Drizzle, ohne Adapter, Isolationstest grün, Muster dokumentiert.

### Phase 3: Domänen migrieren (4–6 Wochen)

Reihenfolge nach Schadenspotenzial, nicht nach Größe:

| #   | Domäne                                                             | Heute          | Besonderheit                                                                                                         |
| --- | ------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | SEPA-Mandate, Zahlungseinstellungen                                | Drizzle        | IBAN über unverschlüsselten Port                                                                                     |
| 2   | Abrechnung (Mitglieder + Trainer)                                  | gemischt       | Abrechnungslauf → SQL-Funktion für Transaktion; gleichzeitig eine Heimat für `lib/billing*`                          |
| 3   | Mitglieder, Probetraining, Gruppen                                 | gemischt       |                                                                                                                      |
| 4   | Trainer: Profile, Stunden, Abwesenheit, Verfügbarkeit, Anwesenheit | Drizzle        | 5 Adapter-Paare                                                                                                      |
| 5   | Saisonplanung (23 Routes)                                          | Drizzle        | größter Block; `confirm`, `inactive-weeks`, `reschedule` als SQL-Funktionen; Clustering-Engine liest über Repository |
| 6   | Service-Client-Routes ohne Systemgrund                             | Service-Client | auf `getUserDb` umstellen oder in die Whitelist mit Begründung                                                       |
| 7   | Rest (Clubs, Buchungen, Preise, Analytics, Owner)                  | gemischt       | `clubs/[id]` und `owner/memberships` haben Transaktionen                                                             |

Definition of Done je Domäne:

- [ ] Routes dünn (Auth → Validierung → Service), keine DB-Aufrufe im Route-File
- [ ] Ein Service-Modul, ein Repository, kein Adapter, kein Interface
- [ ] Kein Import von `persistence/db`, `drizzle-orm` oder `createServiceClient` (außer Whitelist)
- [ ] Zod-Schema an jeder schreibenden Route
- [ ] Isolationstest deckt die Routes ab; bestehende Tests grün; Architektur-Baseline verkleinert
- [ ] Gemergt und in Produktion geprüft (Health-Endpunkt), bevor die nächste Domäne beginnt

Nebenbei, wenn eine Domäne ohnehin angefasst wird: Riesen-Komponenten der Domäne aufteilen
(z. B. `league-detail-client.tsx`, `trainer-detail-client.tsx`) und die drei E-Mail-Services zu
einem zusammenführen.

### Phase 4: Abschluss Infrastruktur (3–5 Tage)

- [ ] `drizzle-orm`, `postgres` aus den Laufzeit-Abhängigkeiten, `src/infrastructure/persistence/`
      entfernen, `DATABASE_URL` aus Vercel entfernen.
- [ ] **Port 6543 am VPS schließen.** Folge-ADR zu ADR-004, Endzustand erreicht.
- [ ] Architektur-Check von „Baseline“ auf „keine Ausnahmen“ umstellen.
- [ ] `DATABASE.md`, `ENVIRONMENTS.md`, `CLAUDE.md` (DO-NOT-Liste, Key Files) nachziehen.

### Aufwand gesamt

| Phase                            | Aufwand                  |
| -------------------------------- | ------------------------ |
| 0 Entscheidung + Sicherheitsnetz | 2–3 Tage                 |
| 1 Zeremonie entfernen            | 2–3 Tage                 |
| 2 Fundament + Referenzdomäne     | ~1 Woche                 |
| 3 Domänen migrieren              | 4–6 Wochen               |
| 4 Infrastruktur-Abschluss        | 3–5 Tage                 |
| **Summe**                        | **~7–9 Wochen** Vollzeit |

Die größte Unsicherheit ist die Saisonplanung (komplexe Abfragen, Transaktionen). Nach der
Referenzdomäne in Phase 2 die Schätzung für Phase 3 anhand der tatsächlichen Dauer neu bewerten.

**Bei Option A** entfallen die SQL-Funktionen für Transaktionen. Dafür kommen dazu:
Infrastruktur-Umzug oder Wechsel zu Managed Supabase (eigene ADR, vorab), Drizzle-RLS-Wrapper
mit eigener DB-Rolle, Migration der ~157 Supabase-Client-Routes zu Drizzle und dauerhafte Pflege
von `schema.ts`. Grob gleicher bis höherer Aufwand, mit Infrastruktur-Risiko am Anfang.

---

## 7. Werkzeuge und Skills für das Refactoring

### Bereits im Projekt vorhanden

| Werkzeug                                                                                  | Einsatz                                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **knip** (`npm run knip`)                                                                 | toter Code, ungenutzte Exporte und Abhängigkeiten (Phase 1, nach jeder Domäne)                                                                           |
| **Vitest / Playwright**                                                                   | Sicherheitsnetz; Isolationstest (Phase 0)                                                                                                                |
| **tokensave** (MCP)                                                                       | vor jeder Änderung Auswirkungen prüfen: `tokensave_impact`, `tokensave_callers`, `tokensave_rename_preview`, `tokensave_dead_code`, `tokensave_circular` |
| **Supabase Agent Skills** (`.claude/skills/supabase`, `supabase-postgres-best-practices`) | offizielle Regeln von Supabase zu RLS, Rollen, Connection-Management, Funktionen: passt direkt zu Option B                                               |
| `.claude/skills/nextjs-app-router-patterns`                                               | dünne Route-Handler, Server/Client-Grenzen                                                                                                               |

### Claude-Code-Skills (installiert)

| Skill                                              | Einsatz                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `/code-review`, `/review`                          | jede migrierte Domäne vor dem Merge prüfen                          |
| `/simplify`                                        | nach der Migration einer Domäne: Wiederverwendung und Vereinfachung |
| `/cso`, `ecc:security-review`                      | Mandantentrennung und Service-Client-Whitelist prüfen               |
| `ecc:database-migrations`, `ecc:postgres-patterns` | SQL-Funktionen für die 9 Transaktionen, Views für Saisonplanung     |
| `ecc:refactor-clean`                               | Phase 1 (toter Code mit knip)                                       |
| `ecc:architecture-decision-records`                | ADR-005                                                             |

### Installiert und konfiguriert (13.09.2026)

| Werkzeug                 | Konfiguration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **dependency-cruiser**   | `.dependency-cruiser.cjs`: `error` für Domain-Reinheit (`src/domain` → keine `infrastructure`/`application`, heute 0 Verstöße) und Zirkularität; `warn` als Baseline für direkten DB-Zugriff aus `app/components/hooks` (Zielbild § 5.1). `.dependency-cruiser-known-violations.json` grandfathert die 180 heutigen Verstöße (`npm run arch:baseline` erzeugt sie neu) — `npm run arch:check` (mit `--ignore-known`) schlägt nur bei **neuen** Verstößen fehl, `npm run arch:check:all` zeigt alle. Läuft in `.husky/pre-commit` (Schritt 4), nur wenn `app/components/hooks/lib/src`-Dateien gestaged sind. Setzt AGENTS.md § 3a („Regeln werden geprüft, nicht geglaubt“) für Architektur um. | ✅ aktiv                           |
| **ts-morph**             | `scripts/codemod-project.ts`: vorkonfiguriertes `Project` (liest `tsconfig.json`) plus `saveIfChanged()`-Helfer für Massenänderungen mit Typverständnis (Imports umhängen, `withApiAuth`-Signatur umstellen, `rowToX`-Mapper ersetzen). Kein eigenständiges Skript — jeder Codemod importiert davon und wird einzeln unter `--dry-run` geprüft.                                                                                                                                                                                                                                                                                                                                                 | ✅ bereit, wird ab Phase 2 benutzt |
| **Supabase DB Advisors** | Kein Install nötig — Teil der bereits vorhandenen Supabase-CLI (`supabase db advisors`, `supabase db lint`). Nach jeder neuen SQL-Funktion/Policy laufen lassen (findet Tabellen ohne RLS, zu offene Policies, `SECURITY DEFINER`-Fälle).                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ✅ verfügbar                       |

### Phase 0 begonnen (13.09.2026)

**Konkreter Fund statt nur Theorie:** Beim Bau des Isolationstests wurde `GET
/api/trial-trainings/[id]/route.ts` geprüft — `trialTrainingService.getTrialTrainingById(id)`
wird ohne `clubId` aufgerufen. Der Adapter defaulted `clubId: string = ''`, das Repository
filtert zwingend `eq(trialTrainings.club_id, clubId)` → Ergebnis ist `WHERE club_id = ''`,
also ein 404 für jeden echten Verein (fail-closed, kein Leck in diesem Einzelfall, aber
funktional kaputt). Dasselbe Muster in einem anderen Repository, das clubId nicht filtert
statt gleichzusetzen, wäre ein echtes Cross-Tenant-Leck statt eines 404 — der Unterschied ist
Zufall, nicht Absicht. **`clubId: string = ''`** existiert in 4 Adapter-Dateien
(`absence-`, `fee-configuration-`, `payment-settings-`, `trial-training-service.adapter.ts`,
je 8–15 Methoden). Die Repositories selbst verlangen `clubId` korrekt als Pflichtparameter —
der Bruch passiert ausschließlich im Adapter darüber, der TypeScript daran hindert, eine
fehlende clubId beim Aufrufer zu melden.

**Statt der ursprünglich geplanten Live-HTTP-Prüfung** („als Admin von Sandbox Alpha jede
GET-Route mit IDs aus Sandbox Beta aufrufen“) wurde ein **statischer Regressionstest**
umgesetzt: `src/__tests__/security/no-defaulted-club-scope.test.ts`, in derselben Machart wie
das bestehende `season-tenant-isolation.test.ts` (Quelltext-Scan, Baseline mit bekannten
Altfällen, kein Ausklammern). Grund für die Abweichung vom Plan: **Sandbox Beta ist absichtlich
leer** (Onboarding-Testfall, § Test-Accounts in `CLAUDE.md`) — die geplante Prüfung bräuchte
einen zweiten, befüllten Fremdverein (Gamma) und pro Domäne eine passende Fremd-ID, real
authentifiziert über einen laufenden Server. Das ist machbar, aber selbst eine Größenordnung
Arbeit wert (pro Route: Tabelle/Spalte für die Fremd-ID ermitteln, echten Login, echte
Cookies) — der statische Scan trifft dieselbe Fehlerklasse (Aufrufer vergisst clubId) für
alle 4 betroffenen Dateien sofort, ohne Server, ohne Flakiness, und griff beim ersten Lauf
bereits einen echten Fund auf. Die Live-HTTP-Variante bleibt sinnvoll, aber realistischer erst
ab Phase 2: sobald `getUserDb(auth)` steht, gibt es einen einzigen Codepfad, gegen den sich
ein generischer Live-Test lohnt, statt gegen ~85 verschiedene Drizzle-Aufrufstellen einzeln.

Baseline heute: **180 bekannte Verstöße** (176 warn: direkter DB-Zugriff + 2 Orphans, 4 error:
Zirkularitäten in `lib/billing/family-invoice-merge.ts`, `components/admin/perf-history-*`,
`app/api/admin/perf-history/github/route.ts`, `superadmin/(gated)/dashboard/*`). Die vier
Zirkularitäten sind unabhängig vom Datenzugriffs-Umbau und können vorgezogen werden, sobald
diese Dateien ohnehin angefasst werden.

Nicht empfohlen: Enterprise-Plattformen für Massen-Refactoring (OpenRewrite/Moderne, Sourcegraph
Batch Changes). Für ein Repo dieser Größe ist das zu schwergewichtig. Ebenso keine
KI-Komplettumbauten ganzer Domänen ohne vorher grünen Isolationstest.

---

## 8. Methodik

- Zählungen am Arbeitsstand `main` @ `52b7c225` plus uncommittete Änderungen, 13.09.2026.
- Drizzle-Nutzung transitiv: alle Nicht-Test-Dateien, die `persistence/(db|repositories|schema)`
  oder `drizzle-orm` importieren, vier Runden über `@/…`-Importe erweitert, dann mit
  `app/api/**/route.ts` geschnitten. Type-only-Importe werden mitgezählt, daher leicht
  überschätzt.
- Service-Client: direkte Nennung von `createServiceClient` im Route-File (indirekte Nutzung über
  `lib/` nicht mitgezählt, daher unterschätzt).
- Validierung: schreibende Routes ohne `zod`, `z.`, `schema.parse`/`safeParse` oder `validat*`
  im File (Heuristik).
- Duplikation: `jscpd@4`, min. 80 Tokens, ohne Tests und `schema.ts`.
- Toter Code: `npx knip` mit Projekt-`knip.json`.

## Quellen

- Drizzle ORM: Row-Level Security: https://orm.drizzle.team/docs/rls
- Beispielimplementierung Drizzle + Supabase RLS: https://github.com/rphlmr/drizzle-supabase-rls
- Supabase Agent Skills: https://github.com/supabase/agent-skills, https://supabase.com/docs/guides/ai-tools/ai-skills
- Architektur-Werkzeuge (dependency-cruiser u. a.): https://jmulholland.com/architecture-tools/
- ts-morph für AST-basiertes Refactoring: https://kimmo.blog/posts/8-ast-based-refactoring-with-ts-morph/
- Codemod-Werkzeuge im Vergleich: https://www.pkgpulse.com/guides/recast-vs-jscodeshift-vs-ts-morph-codemods-code-2026
