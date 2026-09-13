# Grundlegende Projektanalyse — 31.08.2026

> **Art:** Archiv-Snapshot. Dieser Bericht beschreibt den Zustand zum 31. August 2026 und wird nicht nachträglich gepflegt. Folgeprüfungen erhalten einen neuen datierten Bericht.
>
> **Prüfumfang:** Repository-Struktur, Architektur, TypeScript, Build, Tests, Linting, Formatierung, Abhängigkeiten, Datenbank-/RLS-Risiken, Authentifizierung, API-/Webhook-Flows, Rate-Limits, Deployment, CI/CD, Dokumentation und Wartbarkeit.
>
> **Wichtige Einschränkung:** Dies ist eine statische und lokal ausgeführte Analyse. Es wurde keine produktive Datenbank verändert und kein Deployment ausgelöst. Live-Konfigurationen, reale RLS-Policies, Vercel-Settings und externe Providerzustände müssen separat gegen die Produktionsumgebung verifiziert werden.

---

## 1. Kurzfazit

SwingZ ist eine umfangreiche Next.js-/Supabase-Anwendung mit klar erkennbaren Architektur- und Sicherheitsleitplanken: App Router, getrennte Supabase-Clients, CSRF-Schutz, Rollenmodell, Rate-Limits, Sentry, CI und eine konsolidierte Migrations-Baseline. Der Produktionsbuild funktioniert und die meisten automatisierten Qualitätsprüfungen sind grün.

Der wichtigste Gegenbefund ist, dass der grüne Standardpfad nicht den gesamten Qualitätszustand abbildet:

- Der vollständige Strict-Typecheck schlägt in einem Test fehl.
- Die Unit-/Integrationstests schlagen mit einem reproduzierbaren Statistik-Test fehl.
- Prettier meldet 39 nicht formatierte Dateien.
- Knip meldet 62 ungenutzte Exporte, 18 ungenutzte exportierte Typen und 7 doppelte Exporte.
- Mehrere kritische Produktionsrisiken sind weiterhin offen und bereits in `docs/OPEN_ITEMS.md` dokumentiert.
- Die Baseline enthält weiterhin überpermissive Grants auf `SECURITY DEFINER`-Funktionen; das ist ein unmittelbares RLS-/Geldpfad-Risiko.

**Gesamtbewertung:** technisch fortgeschrittene, aber noch nicht vollständig release-harte Plattform. Vor einem kommerziellen Launch sollten insbesondere Datenbank-Grants/RLS, Zahlungsidempotenz, Cron-Ausführung, Produktionskonfiguration, Strict-Typecheck und der fehlschlagende Statistik-Test geschlossen werden.

---

## 2. Verifizierte Projektbasis

### 2.1 Stack

- Next.js `16.2.11`, App Router und Turbopack
- React `18.3.1`
- TypeScript `5.9.3`, Strict-Konfiguration vorhanden
- Supabase: PostgreSQL, Auth, REST, Storage, Realtime
- Drizzle ORM / `postgres-js` für ausgewählte Infrastrukturpfade
- Tailwind CSS und shadcn/ui/Radix
- Stripe `22.3.2`
- Resend, Google Gemini, Upstash Redis, Sentry
- Vitest `4.1.10`, Playwright `1.61.1`
- pnpm `10.34.4`, Node `>=24`

### 2.2 Größenordnung

Zum Prüfzeitpunkt:

| Bereich                                   |                                                   Befund |
| ----------------------------------------- | -------------------------------------------------------: |
| Getrackte Dateien                         |                                                    1.888 |
| API-Route-Dateien                         |                                                      321 |
| Seiten (`page.tsx`)                       |                                                      122 |
| React-Komponenten (`components/**/*.tsx`) |                                                      140 |
| Dateien unter `lib/`                      |                                                      132 |
| Dateien unter `src/`                      |                                                      225 |
| Aktive Root-Migrationen                   |                                    7, inklusive Baseline |
| Archivierte Migrationen                   |                                                      177 |
| Testdateien laut Glob                     | 138 sichtbare Treffer; Vitest führte 105 Testdateien aus |
| Git-Branch                                |           `main`, sauberer Arbeitsbaum zum Analysebeginn |

Die Projektgröße ist für eine einzelne Next.js-Anwendung bereits hoch. Die Zahl der API-Routen und die parallele Existenz von `app/`, `lib/` und Clean-Architecture-Schichten erhöhen die Gefahr von Drift und Doppelimplementierungen.

### 2.3 Architektur

Die dokumentierte Zielstruktur ist grundsätzlich sinnvoll:

```text
app/                    Next.js-Seiten und API-Routen
components/             gemeinsame UI-Komponenten
lib/                    Auth, Clients, Services, Utilities, Integrationen
src/application/        Use Cases und Adapter
src/domain/             Entities, Value Objects, Domain Services
src/infrastructure/     Datenbank, Repositories, externe Systeme
supabase/migrations/    Baseline plus neue Migrationen
```

**Stärken:**

- Zentrale Auth-Helfer (`requireAuth`, `withApiAuth`, Rollenprüfung)
- `server-only` am Service-Role-Client
- Gemeinsame API-/Pagination-/Logger-/CSRF-Helfer
- Separate Migrations-Baseline und archivierte Vorgeschichte
- CI mit Typecheck, Unit-Tests, Dependency-Audit und Migrationstest
- Umfangreiche fachliche Tests für Saisonplanung, Buchungen, Billing und RLS

**Architekturrisiken:**

1. Fachlogik liegt teils in `lib/`, teils in `src/application`, teils direkt in API-Routen.
2. Es existieren parallele bzw. doppelte Stripe-Webhook-Abstraktionen.
3. Drizzle- und Supabase-REST-Pfade verwenden unterschiedliche Sicherheitsmodelle.
4. Die große Route-/Komponentenanzahl macht manuelle Konsistenzprüfung unwirtschaftlich.
5. Knip-Treffer deuten auf eine öffentliche API-Oberfläche hin, die größer ist als die reale Nutzung.

---

## 3. Prüfresultate

| Prüfung                         | Ergebnis | Bewertung                                                                     |
| ------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `pnpm typecheck`                | Exit 0   | Standard-Typecheck grün                                                       |
| `pnpm tsc:strict`               | Exit 2   | **Fehler:** `countOnly` in `src/__tests__/api/clubs.test.ts:241` nicht im Typ |
| `pnpm tsc:scripts`              | Exit 0   | Script-Typecheck grün                                                         |
| `pnpm lint`                     | Exit 0   | ESLint grün; mehrere Accessibility-Regeln nur Warnungen/abgeschwächt          |
| `pnpm build`                    | Exit 0   | Produktionsbuild kompiliert und generiert 246 statische Seiten                |
| `pnpm test:run`                 | Exit 1   | **1 Fehler, 104 Dateien grün; 1.544 Tests grün, 10 übersprungen**             |
| `pnpm docs:check`               | Exit 0   | Doku-Governance grün                                                          |
| `pnpm check:design`             | Exit 0   | Design-Token-Prüfung grün                                                     |
| `pnpm format:check`             | Exit 1   | **39 Dateien nicht formatiert**                                               |
| `pnpm knip`                     | Exit 1   | **62 ungenutzte Exporte, 18 ungenutzte Typen, 7 doppelte Exporte**            |
| `pnpm audit --audit-level=high` | Exit 0   | Keine bekannten High-/Critical-Abhängigkeitsschwachstellen                    |

### 3.1 Fehlgeschlagener Strict-Typecheck

**Datei:** `src/__tests__/api/clubs.test.ts:241`

Der Test-Helfer `makeChain()` akzeptiert laut Typ nur:

```ts
{
  data?: unknown[] | null;
  count?: number | null;
  error?: { message: string } | null;
}
```

Der Test übergibt zusätzlich `countOnly: true`:

```ts
const countChain = makeChain({ count: 0, countOnly: true });
```

`countOnly` wird in der Implementierung nicht verwendet. Mögliche saubere Lösungen:

- `countOnly` aus dem Testaufruf entfernen; oder
- den Parameter entfernen, falls er historischer Rest ist; oder
- nur dann typisieren, wenn der Mock damit tatsächlich Verhalten steuert.

**Priorität:** P2. Der normale Typecheck ignoriert `src/__tests__`; der Strict-Check deckt den Fehler auf. CI sollte `tsc:strict` zusätzlich verbindlich ausführen.

### 3.2 Fehlgeschlagener Test

**Datei:** `src/__tests__/integration/statistics-dashboard.test.ts:922`

Fehler:

```text
conversion-rate metric uses percentage unit
expected 0 to be greater than 0
```

Der Test erwartet für die Dashboard-Metrik `conversion-rate` einen positiven Wert. Der zugrunde liegende Mock enthält jedoch vier konvertierte Probetrainings, während der Dashboard-Code offenbar einen anderen Zeitraum, eine andere Aggregation oder eine leere Datenquelle verwendet.

Auffällig ist, dass die fachliche Vorprüfung `calculateMemberStatistics()` für dieselben Mockdaten eine positive Conversion Rate erwartet. Das spricht für eine Inkonsistenz zwischen:

- `calculateMemberStatistics()` und
- `getDashboardMetrics()` bzw. dessen Trend-/Zeitraumlogik.

**Priorität:** P1. Ein Dashboard kann geschäftlich falsche KPIs zeigen, obwohl die Kernberechnung separat getestet wird.

**Empfohlene Untersuchung:**

1. Berechnung der Metrik in `src/application/services/statistics.service.ts` identifizieren.
2. Zeitfenster von `getDashboardMetrics()` und `calculateMemberStatistics()` vergleichen.
3. Definieren, ob Conversion Rate = konvertierte Probetrainings / alle abgeschlossenen Probetrainings oder eine andere Formel bedeutet.
4. Einen Test mit explizitem Datum und erwarteter Formel ergänzen.
5. Mocks und produktive Datenquelle angleichen.

### 3.3 Testwarnungen

Der Testlauf ist zwar überwiegend grün, zeigt aber relevante Warnsignale:

- Mehrfach: `Multiple GoTrueClient instances detected in the same browser context`.
- React-Email-Warnung: `<title>` erhält mehrere Child-Nodes; dadurch kann der Titel als Markup/Text aggregiert werden und Hydration-Probleme verursachen.
- Mehrere absichtlich geloggte `[ERROR]`-/`[WARN]`-Meldungen aus Negativtests erschweren die Auswertung echter Fehler.
- Ein Stripe-/Billing-Test protokolliert Fehlerobjekte teilweise als nicht-informative Zeichenobjekte bzw. `undefined`.

**Optimierung:** Test-Clients zentralisieren, Logger im Testmodus strukturiert mocken und die React-Email-Title-Komponente auf einen einzelnen String reduzieren.

---

## 4. Sicherheitsanalyse

### 4.1 P0 — Überpermissive `SECURITY DEFINER`-RPC-Grants

**Beleg:** `supabase/migrations/00000000000000_baseline_2026-08-16.sql`, insbesondere ab ca. Zeile 12922.

Die Baseline vergibt für zahlreiche Funktionen:

```sql
GRANT ALL ON FUNCTION ... TO anon;
GRANT ALL ON FUNCTION ... TO authenticated;
GRANT ALL ON FUNCTION ... TO service_role;
```

Das betrifft auch `SECURITY DEFINER`-Funktionen. Besonders kritisch ist:

```sql
check_and_record_stripe_event(...)
```

Diese Funktion wird zur Stripe-Event-Deduplizierung verwendet. Wenn ein anonymer Client Event-IDs vorab registrieren darf, kann ein echter Webhook später als bereits verarbeitet gelten. Das erzeugt ein Denial-of-Service-Risiko auf dem Zahlungs- und Rechnungsverbuchungspfad.

Weitere sensible Beispiele laut Baseline sind Funktionen für:

- Buchungserstellung
- Rechnungs- und Saldoänderungen
- Saisonrechnungen
- Background Jobs
- Audit-/Finance-Trigger
- Cron-/Job-Verarbeitung

**Empfehlung:** Neue Migration mit expliziten `REVOKE`-Anweisungen für `anon` und `authenticated`; danach nur die minimal benötigten `EXECUTE`-Rechte vergeben. Für privilegierte interne Funktionen sollte der Aufruf ausschließlich über `service_role` oder eine strikt kontrollierte API-Schicht möglich sein. Vor Anwendung die Live-Policies und exakten Funktionssignaturen mit `pg_proc`/`information_schema` verifizieren.

**Priorität:** P0 — vor Verkauf/Launch.

### 4.2 P0 — RLS-/Drizzle-Service-Pfad

Laut `docs/OPEN_ITEMS.md` verbindet `DATABASE_URL` als PostgreSQL-Rolle mit `BYPASSRLS`. Dadurch hängt die Tenant-Isolation bei ungefähr 26 Drizzle-Routen allein an Anwendungscode und nicht an PostgreSQL-RLS.

Risiken:

- Ein fehlender `club_id`-Filter kann Cross-Tenant-Zugriff ermöglichen.
- Ein zukünftiger Entwickler kann eine Repository-Abfrage hinzufügen, ohne den Sicherheitskontext zu kennen.
- `FORCE ROW LEVEL SECURITY` schützt den aktuellen DB-User nicht, wenn dieser RLS umgehen darf.

**Empfehlung:** Dedizierte App-Rolle ohne `BYPASSRLS`, minimale Grants, verbindlicher Tenant-Kontext im Repository und Cross-Tenant-Integrationstests für jeden Drizzle-Pfad.

**Priorität:** P0.

### 4.3 P0/P1 — Nicht angewendete oder unvollständige Migrationen

Dokumentiert offene Punkte:

- `20260812020000_scope_remaining_superadmin_policies.sql` liegt vor, ist aber laut Doku nicht angewendet.
- Billing-Scoping-Migration ist vorbereitet, aber Live-Anwendung offen.
- `season_planning_configs` und `season_statistics` waren als RLS-/Policy-Lücke dokumentiert; die Baseline enthält inzwischen Policies, der Live-Zustand muss trotzdem separat geprüft werden.
- Migrations-Tracking kennt laut `OPEN_ITEMS.md` nur einen Teil der Dateien.

**Empfehlung:**

1. Live-Schema mit `pg_policies`, `pg_proc`, `information_schema.tables` und `supabase_migrations.schema_migrations` erfassen.
2. Baseline als alleinige Quelle für neue Umgebungen beibehalten.
3. Jede neue Migration gegen eine leere DB ausführen.
4. Produktionsmigrationen nur mit dokumentiertem Dry-Run, Backup und Rollback-/Recovery-Plan anwenden.
5. CI darf keine Migration als „erledigt“ markieren, wenn sie nur im Repository liegt.

### 4.4 Webhook-Idempotenz ist im Fehlerfall fail-open

In `app/api/webhooks/stripe/route.ts` wird ein Fehler beim RPC `check_and_record_stripe_event` abgefangen und der Event trotzdem verarbeitet.

Das verhindert zwar Ausfälle bei unvollständiger Infrastruktur, öffnet aber bei einem RPC-/DB-Problem die Tür für doppelte Verarbeitung. Bei Geldbewegungen ist fail-open grundsätzlich gefährlich.

**Empfehlung:**

- Idempotenz-Tabelle und RPC als harte Voraussetzung behandeln.
- Bei nicht verfügbarer Deduplizierung `503` liefern oder Events in eine durable Retry-Queue stellen.
- Alarm/Heartbeat für „Idempotency unavailable“ einführen.
- Für alle Zahlungsobjekte zusätzliche Unique Constraints auf externe IDs sicherstellen.

**Priorität:** P1, nach P0-Grant-Fix.

### 4.5 Cron-Authentifizierung und Ausführung

Die aktuelle Codebasis enthält inzwischen sowohl `GET` als auch `POST` für die Buchungserinnerungen und Bearer-Auth für `prune-audit-logs`; der frühere Fehler aus dem Archiv ist im aktuellen Code zumindest teilweise korrigiert. Die Analyse zeigt jedoch weiterhin drei historische Auth-Muster:

- Bearer-Token
- `x-cron-secret`
- beide Varianten

Das ist unnötige Komplexität und erhöht das Risiko, dass eine neue Cron-Route wieder nicht mit Vercel kompatibel ist.

**Empfehlung:** Einen gemeinsamen `verifyCronSecret(request)`-Helper verwenden, Bearer als kanonische Variante definieren und Header-Kompatibilität nur bewusst/für Übergang unterstützen. Jeden Cron-Endpunkt mit einem Auth-Test für gültig, ungültig und fehlend absichern.

### 4.6 Service-Role-Client

`lib/supabase/service.ts` ist mit `import 'server-only'` geschützt. Das ist korrekt.

Weiterhin wichtig:

- Service-Client nur in Server Components, Server Actions, API-Routen und Server-Services verwenden.
- Keine Nutzereingaben ungeprüft in Service-Role-Abfragen übernehmen.
- Service-Role-Nutzung in Code-Review als Sicherheits-Hotspot markieren.

### 4.7 CSRF und globale Rate-Limits

Positiv:

- Double-Submit-Cookie
- timing-sicherer Tokenvergleich
- API-Mutationen werden abgedeckt
- Webhook-/Cron-Ausnahmen sind explizit
- Upstash-Limiter vorhanden

Risiken:

- `proxy.ts` nutzt bei Rate-Limit-Ausfall fail-open.
- `lib/rate-limit.ts` fällt in Serverless auf einen lokalen In-Memory-Store zurück, der zwischen Invocations nicht zuverlässig geteilt wird.
- Die IP-Ermittlung basiert auf Forwarded-Headern; diese müssen im jeweiligen Hosting-Kontext als vertrauenswürdig gelten.
- `proxy.ts` enthält `console.warn`, entgegen der projektierten Logger-Konvention.

**Empfehlung:** Fail-open als bewusstes SLO dokumentieren, Alarm bei Backend-Ausfall auslösen und für Auth-/Payment-/Upload-Routen bei fehlendem Redis konservativere Schutzmaßnahmen verwenden.

### 4.8 SVG-Uploads

`next.config.js` setzt:

```js
dangerouslyAllowSVG: true;
```

Zusammen mit User-Uploads aus Supabase Storage entsteht ein potenzieller SVG-XSS-/Content-Sniffing-Risikobereich. `contentDispositionType: 'attachment'` reduziert das Risiko, ersetzt aber keine Sanitization.

**Empfehlung:** User-SVGs ablehnen oder serverseitig sanitizen; nur vertrauenswürdige SVG-Quellen zulassen; Content-Type und Download-Verhalten explizit testen.

### 4.9 Fehlermeldungen und Datenleaks

Der zentrale Hinweis in `lib/api-error.ts` ist richtig, aber der Scan findet weiterhin zahlreiche Stellen, die `error.message` in Exceptions, Logs oder teilweise Response-Objekte übernehmen.

Besonders zu prüfen:

- `lib/api-auth.ts`
- Billing-/Payment-Services
- Gruppen-/Trainer-/Court-Routen
- Cron-Routen
- Import-/Export-Routen
- `payment-settings/[id]/test`
- `lib/services/billing.service.ts`

Nicht jede Fundstelle ist ein tatsächlicher Client-Leak; viele landen nur im Server-Log. Es fehlt jedoch eine maschinelle Garantie, die Response-Objekte von Log-Objekten trennt.

**Empfehlung:** Einheitliche `publicErrorResponse()`-/`internalError()`-Pfade, statische Regel für `NextResponse.json({ error: error.message })` und Regressionstest gegen typische SQL-Fehlermeldungen.

### 4.10 Secrets und lokale Backups

Getrackte Dateien enthalten laut Prüfung nur `.env.example`; lokale `.env.local`, `.env.prod.local` und Backups sind ignoriert. Das ist gut, aber lokale Secret-Backups liegen laut bestehender Dokumentation im Repository-Verzeichnis.

**Empfehlung:** Secrets außerhalb des Repository-Pfads speichern, Backup-Dateien löschen/verschieben, pre-commit-Secret-Scanning ergänzen und `git diff --cached` in den Commit-Workflow aufnehmen.

---

## 5. Datenbank und Persistenz

### 5.1 Positives

- Baseline schließt die frühere Lücke „Migration setzt nicht angelegte Tabellen voraus“.
- Archivierte Migrationen bleiben unverändert.
- Es existieren lokale Reset-/Migrationsprüfungen.
- RLS ist in mehreren Tabellen aktiviert und Policies sind teilweise tenantbezogen.
- Atomare RPCs werden für einige Finanz-/Buchungsvorgänge eingesetzt.

### 5.2 Risiken

- Live-Migrationshistorie und Repository-Historie sind laut Doku nicht vollständig synchron.
- Billing-Tabellen waren/ sind ein Scoping-Hotspot.
- Drizzle-Verbindung und Supabase-REST haben unterschiedliche Trust Boundaries.
- Direkte DB-Verbindung nutzt laut Dokumentation einen problematischen Transport-/TLS-Zustand.
- Einige Tabellen-/RPC-Sicherheiten hängen an der korrekten Live-Anwendung von Migrationen.

### 5.3 Optimierungen

1. Eine verbindliche Datenbankrolle ohne `BYPASSRLS` einführen.
2. Tenant-Kontext als Pflichtparameter in Repository-Methoden machen.
3. `club_id` für alle clubbezogenen Finanz-/Planungstabellen konsequent erzwingen.
4. Unique Constraints für externe Provider-IDs ergänzen.
5. DB-Constraints statt nur Applikationsvalidierung für Geldbeträge, Statusübergänge und Ownership einsetzen.
6. Query-Performance mit echten `EXPLAIN (ANALYZE, BUFFERS)`-Messungen prüfen.
7. Soft-Delete-/Orphan-Datenhygiene als kontrollierte, owner-freigegebene Jobs ausführen.

---

## 6. API- und Backend-Analyse

### 6.1 API-Oberfläche

Mit 321 API-Routen ist die Oberfläche sehr groß. Das bietet Funktionsumfang, erschwert aber:

- vollständige Auth-/Rollenabdeckung
- einheitliche Fehlerformate
- Rate-Limit-Konsistenz
- OpenAPI-Pflege
- API-Versionierung
- Tenant-Isolation
- E2E-Abdeckung

**Empfehlung:** API-Routen nach Domänen gruppieren und pro Domäne einen Standard etablieren:

```text
Auth → Authentifizierung und Rate-Limit
Authorization → Rolle + Club-Kontext
Validation → Zod-Schema
Use Case → eine fachliche Operation
Persistence → Repository/Adapter
Response → einheitliches JSON-Format
Audit → Erfolg/Fehler und actor/resource
```

### 6.2 Doppelte Stripe-Implementierung

`lib/stripe/stripe-client.ts` enthält eigenes Webhook-Handling. Das produktive Routing liegt jedoch in `app/api/webhooks/stripe/route.ts`. Dadurch existieren zwei Implementierungen für ähnliche Events.

Risiken:

- Bugfix wird nur in einer Variante angewendet.
- Unterschiedliche Idempotenz-/Statuslogik.
- Spätere Entwickler importieren versehentlich die tote Variante.

**Empfehlung:** Webhook-Dispatch in einen einzigen Service extrahieren; `stripe-client.ts` nur für Client/Signatur/Checkout verwenden oder tote Funktionen entfernen. Doppelte Exporte laut Knip bestätigen diesen Aufräumbedarf.

### 6.3 Validierung

Zod ist vorhanden und wird verwendet. Die Anzahl der API-Routen macht jedoch eine systematische Contract-Prüfung nötig:

- Jede Mutation muss ein Zod-Schema haben.
- IDs, Datumsbereiche und Paging müssen zentral validiert werden.
- CSV-/Import-Operationen brauchen Größen-, Zeilen- und Feldlimits.
- Uploads brauchen MIME-, Größen- und Inhaltsprüfung.

### 6.4 Fehlerverträge

Einheitliche deutsche UI-Texte sind als Regel dokumentiert, aber viele interne Fehlermeldungen sind Englisch und könnten über API-Grenzen gelangen. Für Clients sollte ein stabiler Fehlervertrag gelten:

```ts
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Die Eingaben konnten nicht verarbeitet werden.',
    fields?: Record<string, string>
  },
  requestId?: string
}
```

---

## 7. Frontend, UX und Accessibility

### 7.1 Positives

- shadcn/ui/Radix als Basis
- Dark Mode berücksichtigt
- Design-Token-Check grün
- Accessibility-Linting eingebunden
- Fehler-, Empty- und Loading-Komponenten vorhanden
- geschützte Seiten werden nicht gecacht

### 7.2 Risiken

ESLint stuft mehrere jsx-a11y-Regeln auf Warnungen herunter. Das verringert Rauschen, kann aber echte Barrieren verdecken:

- click events ohne Tastaturäquivalent
- nicht-interaktive Elemente mit Interaktionen
- fehlende Label-Verknüpfungen
- Autofocus
- fehlende Captions

**Empfehlung:** Warnungen nach Nutzungskontext kategorisieren, nicht global abschwächen. Für produktkritische Formulare und Navigation sollten Verstöße Fehler bleiben. Regelmäßig Live-/DOM-Audits mit axe/Playwright ausführen.

### 7.3 UX-/Copy-Risiken aus offenen Punkten

Laut `docs/OPEN_ITEMS.md` verbleiben unter anderem:

- Denglisch „Season“ in sichtbaren Texten
- irreführende Empty States
- 405 ohne verständlichen Fehlertext
- uneinheitliche Court-/Platztypen-Darstellung
- zu schwacher E2E-Nachweis für Präferenzseiten

Diese Punkte sind nicht alle technisch kritisch, beeinflussen aber Vertrauen und Bedienbarkeit eines SaaS-Produkts.

### 7.4 React-Email-Warnung

Die Warnung zum mehrteiligen `<title>` sollte behoben werden. E-Mail-HTML ist zwar nicht direkt React-Hydration im Browser, aber ungültige/mehrteilige Title-Knoten können zu fehlerhafter Darstellung in Mailclients und Rendering-Tools führen.

---

## 8. Performance und Skalierbarkeit

### 8.1 Aktuelle Schutzmaßnahmen

- Next Image mit AVIF/WebP
- `optimizePackageImports`
- SplitChunks-Konfiguration
- Recharts/DnD/TanStack in getrennten Gruppen
- Kompression
- Performance-Benchmark-Workflow
- Clustering-Benchmarks und Performance-Reports

### 8.2 Risiken

1. `splitChunks` wird manuell stark konfiguriert; Next.js-/Turbopack-Verhalten kann davon abweichen.
2. `recharts`, DnD und große Supabase-/OpenAI-Pakete können Client-Bundles belasten.
3. Viele dynamische Seiten und API-Routen erschweren End-to-End-Latenzmessung.
4. Fallbacks auf In-Memory-Caches/Rate-Limits sind in Serverless nicht dauerhaft.
5. Eine große Anzahl direkter Service-/Repository-Aufrufe kann N+1-Probleme erzeugen.
6. Die CI-Performance-Benchmarks sind advisory und blockieren keine Regression.

### 8.3 Empfohlene Messungen

- Lighthouse/PageSpeed für Landing und Login
- Web Vitals für geschützte Dashboard-Seiten
- Bundle-Analyzer in CI als Artefakt
- `EXPLAIN ANALYZE` für Dashboard-/Analytics-/Member-Abfragen
- k6/Playwright-Szenario für Login, Memberliste, Buchung und Saisonplanung
- p95/p99-Ziele je API-Domäne

### 8.4 Datenaggregation

Dashboard- und Statistikmetriken sollten möglichst datenbankseitig aggregiert werden. Große `getAll...`-Abfragen und anschließende In-Memory-Berechnung skalieren mit Mitglieder- und Buchungszahlen linear im Node-Prozess und erhöhen Speicher-/Laufzeitkosten.

---

## 9. Tests und Qualitätssicherung

### 9.1 Stärken

- 1.544 grüne Tests im aktuellen Lauf
- RLS-, Cross-Tenant- und Stripe-Tests vorhanden
- saisonale Clustering-/Billing-Logik gut abgedeckt
- E2E-Konfiguration für Desktop und Mobile vorhanden
- Migrationen werden in CI gegen leere DB geprüft
- Coverage-Schwellen sind konfiguriert

### 9.2 Lücken

- Aktueller Testlauf ist nicht vollständig grün.
- Strict-Typecheck wird nicht durch den Standard-`typecheck` abgedeckt.
- E2E-Smoke ist in CI optional und läuft nur bei gesetzter Repository-Variable.
- Die Vollmatrix ist nicht der Standard-CI-Pfad.
- Viele Knip-Treffer zeigen ungetestete oder nicht genutzte Exporte.
- Coverage-Schwellen werden im gezeigten Standardlauf nicht sichtbar ausgegeben.
- Negative Tests erzeugen viel Log-Rauschen.

### 9.3 Priorisierte Testverbesserungen

1. Statistik-Test reparieren und Conversion-Rate-Vertrag festschreiben.
2. `pnpm tsc:strict` in CI ausführen.
3. E2E-Smoke für Login, Rollenrouting, Club-Isolation und Buchung verbindlich machen.
4. Stripe-Webhooks mit Replay, parallelen Requests und fehlender Idempotenz-RPC testen.
5. Alle Cron-Routen mit Vercel-Bearer-Header testen.
6. Upload-Sicherheits- und SVG-Tests ergänzen.
7. DB-Integrationstests in einer isolierten CI-Supabase aktiv ausführen statt nur zu skippen.
8. Contract-Tests für Fehlerformate und Pagination standardisieren.

---

## 10. Abhängigkeiten und Tooling

### 10.1 Dependency Audit

`pnpm audit --audit-level=high` meldete keine bekannten Schwachstellen. Das ist ein positiver Momentaufnahmebefund, kein dauerhafter Sicherheitsnachweis.

Empfehlungen:

- Audit bei jedem PR und regelmäßig gegen Lockfile wiederholen.
- Major-Upgrades von Next.js, React, Stripe, Supabase und Zod separat planen.
- Overrides regelmäßig begründen und auf Upstream-Fixes prüfen.
- SBOM-Erzeugung und Artefaktaufbewahrung beibehalten.

### 10.2 Knip

Knip meldet:

- 62 ungenutzte Exporte
- 18 ungenutzte exportierte Typen
- 7 doppelte Exporte

Nicht alle Treffer sind Fehler: UI-Bibliotheken exportieren häufig bewusst mehrere Primitive. Dennoch sind insbesondere diese Kategorien relevant:

- doppelte Stripe-/Auth-Exports
- parallele Service-Abstraktionen
- ungenutzte Fachtypen
- große Barrel-Dateien wie `components/ui/index.ts`

**Empfehlung:** Treffer in drei Gruppen teilen:

1. bewusst öffentliche API — dokumentieren/konfigurieren
2. nur für Tests oder dynamische Imports — Knip konfigurieren
3. wirklich tot — löschen

### 10.3 Prettier

39 Dateien sind nicht formatiert. Ein Format-Fehler in generierten/externen Dateien sollte über `.prettierignore` gelöst werden; eigener Produktionscode sollte hingegen vollständig formatiert sein.

**Empfehlung:** Prettier-Ignore für `.ds-sync`, Design-Bundles und Archivdateien prüfen, nicht pauschal `format:check` abschwächen. Danach nur eigene Dateien formatieren und den Check grün machen.

---

## 11. CI/CD und Deployment

### 11.1 Positives

- CI auf Push zu `main` und Pull Requests
- `permissions: contents: read`
- Concurrency mit Cancelierung
- pnpm-Lockfile-Installation
- Dependency-Audit
- Migrationstest gegen leere DB
- optionaler E2E-Smoke
- separater Monitor-Workflow
- Performance-Artefakte

### 11.2 Kritische Punkte

1. `vercel.json` nutzt:

   ```json
   "ignoreCommand": "test \"$VERCEL_ENV\" != \"production\""
   ```

   Damit werden Nicht-Production-Deploys übersprungen. Es fehlt ein echter Preview-/Staging-Gate.

2. E2E-Smoke ist optional (`vars.RUN_E2E_SMOKE == 'true'`).

3. Der Produktionsbuild wird in CI nicht im gezeigten `ci.yml` ausgeführt; Typecheck und Tests ersetzen keinen vollständigen Next-Build.

4. Der Monitor prüft externe Produktion und VPS, aber seine Wirksamkeit hängt davon ab, dass der Workflow auf `main` liegt und GitHub-Schedule tatsächlich aktiv ist.

5. Die Vercel-/Hobby-Plan-Einschränkung ist dokumentiert, aber das Deploymentverfahren bleibt operativ fragil.

### 11.3 Empfohlenes Release-Gate

Vor Merge nach `main`:

```text
pnpm tsc:strict
pnpm lint
pnpm test:run
pnpm build
pnpm audit --audit-level=high
pnpm docs:check
pnpm check:design
pnpm format:check
```

Zusätzlich:

- Preview-Deployment für PRs
- Smoke-Test gegen Preview
- DB-Migrationsprüfung
- Security-/RLS-Regression
- manuelle Abnahme der kritischen Rollenflows

---

## 12. Dokumentation und Governance

### 12.1 Positives

- `docs/README.md` ist als Index vorhanden.
- Archiv-/Lebend-/ADR-Regeln sind präzise definiert.
- `docs:check` läuft erfolgreich.
- `CLAUDE.md` und `AGENTS.md` enthalten projektspezifische Regeln.
- Offene Produktionsrisiken sind ungewöhnlich transparent in `docs/OPEN_ITEMS.md` festgehalten.

### 12.2 Verbesserungen

- Lebende Dokumente haben unterschiedliche Verifikationsdaten; nach jeder relevanten Codeänderung muss das Datum aktualisiert werden.
- Einige aktuelle Codebefunde sind in `OPEN_ITEMS.md` bereits bekannt, aber nicht durch automatisierte Checks abgesichert.
- `CLAUDE.md` beschreibt ~255 API-Routen, die aktuelle Zählung liegt bei 321 Route-Dateien. Die Dokumentation ist damit möglicherweise veraltet.
- `docs/README.md` beschreibt 102 DB-Migrationen, im aktuellen aktiven Root liegen 7 Dateien plus Baseline; die historische/aktuelle Zählweise sollte klarer getrennt werden.

**Empfehlung:** Einen kleinen `project-inventory`-Check bauen, der die Zahlen in `CLAUDE.md` nicht automatisch überschreibt, aber Abweichungen meldet.

---

## 13. Priorisierte Maßnahmenliste

### P0 — vor Launch/Verkauf

1. Grants auf `SECURITY DEFINER`-Funktionen korrigieren; `anon`/`authenticated` entfernen, wo nicht zwingend nötig.
2. Live-RLS und Migrationen gegen die Produktionsdatenbank verifizieren.
3. Drizzle-Service-Rolle ohne `BYPASSRLS` einführen.
4. DB-Transport/TLS des Poolers korrigieren.
5. E-Mail-Domain bei Resend verifizieren; Rechnungs-/Mahn-/Einladungsflüsse produktiv testen.
6. Subscription Enforcement vor Launch aktivieren und mit einem echten Free-Konto testen.
7. Kritische Daten-/Zahlungspfade mit Backup, Rollback und Monitoring freigeben.

### P1 — vor dem nächsten Release

1. Statistik-Conversion-Rate-Test reparieren und fachliche Formel vereinheitlichen.
2. Stripe-Webhook-Idempotenz fail-closed oder durable-retry-fähig machen.
3. Jede Stripe-Erstellungsoperation mit stabiler Idempotency-Key-Strategie prüfen.
4. Cron-Auth über gemeinsamen Helper standardisieren.
5. Alle potentiellen API-Response-Leaks von `error.message` schließen.
6. Isolierte CI-/Staging-Supabase für echte Integrationstests bereitstellen.
7. Preview-/Staging-Deployments aktivieren.
8. Produktionsbuild als CI-Gate ergänzen.
9. SVG-Upload-Policy festlegen und testen.

### P2 — strukturelle Qualität

1. Strict-Typecheck-Fehler `countOnly` beheben.
2. Prettier auf eigenen Dateien vollständig grün machen.
3. Knip-Treffer bereinigen und doppelte Exporte entfernen.
4. Doppelte Stripe-Webhook-Implementierung konsolidieren.
5. API-Fehlervertrag und Request-ID standardisieren.
6. Statistik-/Analytics-Abfragen datenbankseitig aggregieren.
7. Accessibility-Warnungen für Kernflows wieder auf Fehlerstufe anheben.
8. Denglische/irreführende UI-Texte aus offenen Punkten bereinigen.

### P3 — laufende Optimierung

1. Bundle-/Lighthouse-Budgets definieren.
2. API-p95/p99 messen.
3. DB-Indizes mit realen Query-Plänen überprüfen.
4. Automatisierte Route-/Dokumentationsinventur hinzufügen.
5. Testlogs im Normalfall leiser und im Fehlerfall strukturierter machen.

---

## 14. Empfohlene Reihenfolge für die Umsetzung

```text
1. DB-Grants und Live-RLS verifizieren
2. Drizzle-BYPASSRLS und TLS beheben
3. Zahlungs-/Webhook-Idempotenz härten
4. E-Mail und Subscription Enforcement produktiv validieren
5. Statistik-Test/Fachlogik reparieren
6. Strict-Typecheck + Build als CI-Gates setzen
7. Preview-/Staging-Deploy einführen
8. API-Fehlerleaks und SVG-Uploads härten
9. Doppelte Exporte/Stripe-Handler bereinigen
10. UX-/Accessibility-/Formatierungsreste abschließen
```

---

## 15. Abschlussbewertung

**Produktreife:** fortgeschritten, aber nicht vollständig releasebereit.

**Codequalität:** gute Grundstruktur und viele Schutzmechanismen, jedoch zu große und teilweise doppelte API-/Service-Oberfläche.

**Sicherheit:** mehrere wichtige Kontrollen vorhanden, aber Datenbank-Grants, `BYPASSRLS`, fail-open-Idempotenz und Produktionskonfiguration sind entscheidende Blocker.

**Tests:** hohe Anzahl und gute fachliche Breite; der aktuelle Lauf ist dennoch nicht grün, und Strict-Typecheck wird nicht ausreichend als Gate genutzt.

**Performance:** solide technische Vorarbeit, aber echte Skalierbarkeit muss mit Produktionsdaten, Query-Plänen und Lasttests belegt werden.

**Dokumentation:** für Agenten und Betrieb überdurchschnittlich gut, aber einige Inventarzahlen und Ist-Zustände müssen regelmäßig nachgezogen werden.

> Dieser Bericht empfiehlt keine automatischen Codeänderungen. Die Befunde sind als priorisierte Arbeitsgrundlage gedacht; Sicherheits- und Datenbankmaßnahmen müssen vor Anwendung gegen den echten Live-Zustand verifiziert werden.
