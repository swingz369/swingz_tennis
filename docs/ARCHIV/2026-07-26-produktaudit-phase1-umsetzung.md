# Phase 1 (Fundament abdichten) — Umsetzungsbericht

> Stand: 26. Juli 2026
> Bezug: [`2026-07-26-produktaudit-verkaufsreife.md`](2026-07-26-produktaudit-verkaufsreife.md) (Original-Audit, unverändert)
> Kategorie: Archiv-Snapshot (nach `AGENTS.md` §1) — dokumentiert, was in dieser Session tatsächlich umgesetzt wurde.

---

## Was erledigt ist

### Testsuite repariert (F-1)

Alle 17 roten Tests behoben — dabei zwei als **falsch spezifiziert** entlarvt statt am Code vorbeigefixt:

- `src/__tests__/api/clubs.test.ts`, `src/__tests__/api/clubs-features.test.ts`: Die Tests behaupteten, ein Superadmin sähe _alle_ Vereine der Plattform. Laut `CLAUDE.md` (verifiziert 21.06.2026) und Nutzerbestätigung gilt: Superadmin sieht **nur seine eigenen** Vereine — das ist die `owner`-Rolle. Beide Tests auf die korrekte Regel umgeschrieben, inkl. neuem Gegenfall-Test (403 bei fremdem Verein).
- `tests/unit/api/branding.test.ts`, `src/__tests__/api/clubs-features.test.ts`: `vi.mock('@/lib/api-auth', () => ({...}))` ersetzte das Modul komplett und ließ `verifyClubAccess` fehlen, das die Route auch aufruft — vitest warf beim Zugriff, die Route fing das im `catch` ab und meldete fälschlich 400/403. Fix: `importOriginal()` beibehalten, nur die gezielt benötigten Exports überschreiben.
- `src/__tests__/lib/clustering-engine.test.ts`: `loadGroups()` in der Clustering-Engine läuft über Supabase-REST (`createServiceClient()`), nicht über Drizzle. Der Test mockte nur das Drizzle-Modul — die Query ging live gegen die echte DB, wo die Fixture-ID `"c1"` keine gültige UUID ist. Fix: `@/lib/supabase/service` gemockt.

Ergebnis: `npx vitest run` → **86/86 Testdateien grün, 1434 Tests, 10 skipped.**

### Aufräumarbeiten (F-4, F-10, F-11)

- `supabase-types.ts` (6.225 Zeilen, 0 Importe) gelöscht. `scripts/gen-supabase-types.sh`, `backup-supabase-types.sh`, `clean-supabase-types.sh` generieren jetzt nur noch `types/supabase.ts` — eine Wahrheit statt zwei.
- Toter Feature-Flag-Mechanismus entfernt: `src/__tests__/integration/feature-flags.test.ts`, `service-migration.test.ts` (prüften einen Mechanismus, den kein Produktivcode mehr liest) sowie die 11 `USE_*_REPOSITORY`-Variablen aus `.env.local`.
- Leerer `catch` in `app/layout.tsx` kommentiert — bewusster Schutz gegen `localStorage`-Zugriffsfehler im Privat-Modus, kein Bug.

### P1 (RLS-Bypass) — sicherer Zwischenschritt statt `FORCE RLS`

**Korrektur am ursprünglichen Plan:** `FORCE ROW LEVEL SECURITY` sofort zu aktivieren hätte die App teilweise lahmgelegt. 445 der RLS-Policies aus den 155 Migrationen prüfen `auth.uid()` — das funktioniert nur mit dem JWT-Kontext, den Supabase-REST-Anfragen mitbringen. Der Drizzle-Pfad (roher `postgres.js`-User) hat diesen Kontext nicht; `FORCE RLS` hätte Saisonplanung, Abrechnung und Trainerverwaltung sofort für alle Nutzer gesperrt. Diese Erkenntnis wurde vor der Umsetzung mit dem Nutzer abgestimmt (Antwort: „Sicherer Zwischenschritt jetzt").

**Stattdessen umgesetzt:** systematischer Scan aller 58 Drizzle-Dateien auf Funktionsebene (welche Funktion greift auf eine der 58 mandantenbehafteten Tabellen zu, ohne `club_id`/`clubId` zu prüfen). Von 77 Rohtreffern waren die allermeisten Repository-Methoden wie `findById(id)`/Mapper-Funktionen — kein eigenständiges Risiko, da die Berechtigungsprüfung beim Aufrufer (der API-Route) liegen muss. Die Prüfung wurde auf die tatsächliche Vertrauensgrenze — `app/api/seasons/[id]/**/route.ts` (26 Routen) — konzentriert.

**Zwei bestätigte, reale Cross-Tenant-Lücken gefunden und behoben:**

1. **`app/api/seasons/[id]/billing/route.ts`** (GET/PUT/POST) — prüfte nur `verifyRole(auth, 'admin')`, die _globale_ Rolle. Ein Admin von Verein A konnte Abrechnungsvorschau und -konfiguration von Verein B lesen und ändern sowie dessen Rechnungslauf auslösen. Fix: `authorizeSeasonAccess()` (bereits vorhandener, korrekter Helfer aus `lib/season-auth.ts`) statt manueller Rollenprüfung.
2. **`app/api/seasons/[id]/preferences/[userId]/route.ts`** (GET/PATCH/DELETE) — dieselbe Lücke bei Trainingspräferenzen einzelner Mitglieder. Fix: neuer `hasClubAdminAccess()`-Guard, der `auth.memberships` gegen `season.club_id` prüft; „eigene Präferenz"-Zugriff bleibt wie vorgesehen unabhängig vom Verein.

**Zusätzlich entdeckt, nicht Teil des ursprünglichen Audits:** In genau zwei Dateien (`calendar/route.ts`, `calendar/toggle/route.ts`) fehlte das `await` vor `verifyRole(...)` — `if (!verifyRole(auth, 'admin'))` prüft ein Promise-Objekt, das immer _truthy_ ist, die Verneinung ist also immer `false`. Die Rollenprüfung griff nie, jeder eingeloggte Nutzer kam durch. Ein repo-weiter Scan bestätigte: nur diese zwei Stellen betroffen. Beide gefixt.

**Dauerhafter Regressionsschutz:** `tests/unit/security/season-tenant-isolation.test.ts` — zwei statische Quellcode-Scans:

- prüft alle 26 `app/api/seasons/[id]/**/route.ts`-Dateien auf ein anerkanntes Mandanten-Schutzmuster (`authorizeSeasonAccess`, `memberships`+`club_id`, oder dokumentierte RLS-Backstop-Ausnahmen für die 5 Routen, die stattdessen über den RLS-geschützten Supabase-Client laufen);
- prüft das gesamte `app/`-Verzeichnis auf fehlendes `await` vor `verifyRole`/`verifyTrainerInClub`/`verifyOffice`.

Beide schlagen fehl, sobald eine neue Route dieselbe Fehlerklasse wiederholt.

**Verifiziert:** `npx tsc --noEmit` → 0 Fehler. `npx vitest run` → 86/86 Dateien grün. `npx next build` → Exit 0.

---

## Was noch aussteht

### P1, Rest — Drizzle-Repository-Ebene

Der Scan hat nur die **API-Route-Ebene** (Vertrauensgrenze) vollständig abgedeckt. Die ~75 als „kein eigenständiges Risiko" eingestuften Repository-Methoden (`findById`, `exists`, `delete` by id) wurden nicht einzeln durchgeprüft, ob wirklich _jeder_ Aufrufer vor dem Aufruf die Vereinszugehörigkeit der übergebenen ID verifiziert. Empfehlung: bei Berührung eines Repositories im Alltag jeweils den/die Aufrufer mitprüfen, kein separates Großprojekt.

### P1, strukturell — `FORCE ROW LEVEL SECURITY`

Bleibt der einzige Weg, die Mandantentrennung auch auf DB-Ebene (nicht nur Anwendungsebene) zu erzwingen. Braucht vorher: JWT-Claim (`auth.uid()`) in die Drizzle-DB-Session injizieren (`SET LOCAL request.jwt.claims` o. ä.) oder Migration des Drizzle-Pfads auf Supabase-REST. Eigene, größere Aufgabe — nicht in dieser Session begonnen, da hohes Produktionsrisiko ohne die Vorarbeit.

### P2 — Unverschlüsselter DB-Transport

**Noch nicht umgesetzt.** Kein docker-compose/Caddy-Config in diesem Repo — die Supavisor-Terminierung läuft auf dem VPS (`178.254.37.110`, außerhalb dieses Repos). Wichtiger Befund vor jeder Änderung: Das Postgres-Wire-Protokoll verhandelt TLS _inline_ (`SSLRequest`-Paket, dann 1-Byte-Antwort `S`/`N`, erst dann TLS-Handshake) — ein generischer TCP-TLS-Wrapper (stunnel/HAProxy `mode tcp ssl`) versteht das nicht automatisch und kann exakt den `ERR_SSL_WRONG_VERSION_NUMBER`-Ausfall vom 21.07. wiederholen. Die korrekte Lösung ist, TLS **in Supavisor selbst** zu konfigurieren (Supabase Cloud terminiert es dort bzw. auf einem vorgeschalteten Load Balancer, nicht über einen naiven TCP-Proxy).

**Nächster Schritt, bevor irgendeine Config geändert wird:** den echten Ist-Zustand auf dem VPS lesen, nicht raten. Read-only, ungefährlich:

```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/manitu_vps deploy@178.254.37.110 \
  'cat /home/deploy/swingz-supabase/docker-compose.yml | grep -A30 "pooler\|supavisor"'
ssh -o IdentitiesOnly=yes -i ~/.ssh/manitu_vps deploy@178.254.37.110 \
  'docker exec supabase-pooler env | grep -iE "ssl|tls|cert"'
```

Erst danach lässt sich eine korrekte, nicht-spekulative TLS-Konfiguration schreiben. Passphrase-geschützter Key — siehe `vps-infra-2026-07-21`-Memory für den `ssh-agent`-Workflow.

### P3, P4, P5 und restliche F-Punkte

Unverändert offen, siehe Original-Audit.
