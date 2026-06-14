# SwingZ — Umfassender Projekt-Audit Prompt

> Kopiere diesen Prompt in eine neue Codebuff-Session, um das gesamte Projekt zu prüfen.

---

## Prompt

````
Führe eine umfassende, tiefgehende Prüfung des SwingZ-Projekts durch. Untersuche JEDEN Aspekt des Projekts auf Herz und Nieren und erstelle einen detaillierten Bericht in docs/COMPREHENSIVE_PROJECT_AUDIT.md.

Das ist ein Next.js 15 + Supabase + TypeScript Projekt für Tennisvereins-Management (Multi-Tenant SaaS).

Prüfe folgende Bereiche SYSTEMATISCH — arbeite dich Bereich für Bereich durch und dokumentiere ALLE Funde:

---

### 1. BUILD & KOMPILIERUNG
- Führe `npx tsc --noEmit` aus — liste ALLE TypeScript-Fehler auf
- Führe `npx next build` aus — liste ALLE Build-Errors und -Warnings auf
- Prüfe ob `npm run lint` / ESLint sauber durchläuft
- Prüfe ob `npm run typecheck` existiert und funktioniert

### 2. DEPENDENCIES & SICHERHEIT
- Führe `npm audit` aus — liste alle Vulnerabilities auf
- Prüfe ob veraltete/pinning Dependencies existieren (`npm outdated`)
- Prüfe ob `package.json` und `package-lock.json` konsistent sind
- Suche nach hardcoded Secrets, API-Keys oder Credentials im Code (nicht in .env)
- Prüfe ob `.env.example` alle benötigten ENV-Variablen dokumentiert
- Prüfe ob sensible Dateien (.env.local, etc.) korrekt in .gitignore stehen

### 3. ARCHITEKTUR & CODE-QUALITÄT
- Prüfe die Projektstruktur — ist Clean Architecture (Domain/Application/Infrastructure) sauber eingehalten?
- Gibt es zirkuläre Imports oder ungewöhnliche Abhängigkeiten?
- Suche nach `any`-Typen, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` Kommentaren
- Suche nach auskommentiertem Code (TODO, FIXME, HACK, XXX)
- Suche nach `console.log`-Statements die nicht `console.error` oder `console.warn` sind (sollten entfernt werden)
- Prüfe ob alle API-Routen korrekte Authentifizierung und Autorisierung haben
- Gibt es unbenutzte Imports, Variablen oder Funktionen?

### 4. DATENBANK & MIGRATIONEN
- Zähle alle Supabase-Migrationsdateien in `supabase/migrations/`
- Prüfe ob die Drizzle-Schema-Datei (`src/infrastructure/persistence/schema.ts`) mit den tatsächlichen DB-Spalten übereinstimmt
- Prüfe ob alle Tabellen `club_id` haben (Multi-Tenant Isolation)
- Prüfe ob RLS-Policies für alle Tabellen definiert sind
- Suche nach fehlenden Foreign-Key-Indexes
- Prüfe ob `created_at` und `updated_at` Timestamps auf allen Tabellen existieren

### 5. SICHERHEIT (SECURITY AUDIT)
- Prüfe ALLE API-Routen auf fehlende Authentifizierung (`withApiAuth` / `requireAuth`)
- Prüfe ob Admin-Routen Rollenprüfungen haben (`verifyRole`)
- Prüfe ob SQL-Injection möglich ist (direkte String-Interpolation in Queries)
- Prüfe ob XSS möglich ist (unsanitized user input in dangerouslySetInnerHTML)
- Prüfe ob CSRF-Schutz vorhanden ist
- Prüfe ob Rate-Limiting auf allen kritischen Endpunkten aktiv ist
- Prüfe ob File-Upload-Endpunkte Dateitypen validieren
- Prüfe ob Passwörter korrekt gehasht werden
- Prüfe ob sensible Daten in API-Responses geleakt werden (z.B. interne IDs, Fehlerdetails)

### 6. API-ENDPUNKTE
- Liste ALLE API-Routen auf (app/api/**)
- Prüfe ob jede Route korrekte HTTP-Methoden (GET/POST/PATCH/DELETE) verwendet
- Prüfe ob Fehlerbehandlung (try/catch, error responses) vollständig ist
- Prüfe ob Request-Validation (zod schemas) überall vorhanden ist
- Prüfe ob 404/403/500 Responses konsistent formatiert sind
- Suche nach API-Routen die keine Response zurückgeben (fehlende return)

### 7. FRONTEND & UI/UX
- Prüfe ob alle Seiten unter verschiedenen Rollen korrekt rendern
- Suche nach fehlenden `key`-Props in Listen-Rendering
- Prüfe ob `useEffect`-Hooks korrekte Dependency-Arrays haben
- Suche nach Memory-Leaks (fehlende Cleanup in useEffect)
- Prüfe ob Loading-States und Error-Boundaries auf allen Seiten existieren
- Prüfe ob leere States (keine Daten) sauber gehandhabt werden
- Suche nach hardcoded deutschen Texten die i18n benötigen

### 8. PERFORMANCE
- Suche nach N+1-Query-Problemen (mehrere DB-Queries in Schleifen)
- Prüfe ob Server Components wo immer möglich verwendet werden (statt Client Components)
- Prüfe ob Bilder optimiert sind (next/image Verwendung)
- Prüfe ob Dynamic Imports für große Komponenten verwendet werden
- Suche nach unnötigen Re-Renders (fehlende useMemo/useCallback)
- Prüfe ob Datenbank-Queries effizient sind (fehlende select-Spalten, fehlende Pagination)

### 9. TESTING
- Zähle alle Test-Dateien (Unit, Integration, E2E)
- Führe `npx vitest run --reporter=verbose` aus — welche Tests bestehen, welche fehlschlagen?
- Prüfe ob kritische Pfade (Auth, Booking, Billing) Testabdeckung haben
- Prüfe ob die E2E-Tests (Playwright) konfiguriert und lauffähig sind
- Suche nach `test.skip` oder `test.todo` — welche Tests wurden übersprungen?

### 10. NEXT.JS SPEZIFISCH
- Prüfe ob `middleware.ts` existiert und korrekt konfiguriert ist
- Prüfe ob alle dynamischen Routen korrekte `params`-Typisierung haben (Next.js 15/16 Promise-Syntax)
- Prüfe ob `force-dynamic` / `revalidate` Einstellungen sinnvoll sind
- Prüfe ob Error-Boundaries (`error.tsx`) auf allen Route-Segmenten existieren
- Prüfe ob Loading-States (`loading.tsx`) auf wichtigen Seiten existieren
- Prüfe ob `metadata` exports auf allen Seiten vorhanden sind (SEO)

### 11. DOKUMENTATION
- Prüfe ob README.md vollständig und aktuell ist
- Prüfe ob API-Dokumentation existiert
- Prüfe ob Architektur-Dokumentation aktuell ist
- Prüfe ob Deployment-Anleitung existiert
- Prüfe ob CHANGELOG gepflegt wird

### 12. DEPLOYMENT & INFRASTRUKTUR
- Prüfe ob Docker-Dateien korrekt sind
- Prüfe ob Vercel-Konfiguration (vercel.json) sinnvoll ist
- Prüfe ob Environment-Variablen für Produktion dokumentiert sind
- Prüfe ob Sentry/Error-Tracking korrekt konfiguriert ist

### 13. BARREILOME & ACCESSIBILITY
- Prüfe ob ARIA-Labels auf interaktiven Elementen vorhanden sind
- Prüfe ob Keyboard-Navigation funktioniert
- Prüfe ob Farbkontraste ausreichend sind
- Prüfe ob `prefers-reduced-motion` respektiert wird

### 14. GIT & WORKFLOW
- Prüfe ob `.gitignore` vollständig ist
- Prüfe ob uncommitted changes existieren
- Prüfe ob Husky/Pre-commit-Hooks konfiguriert sind
- Prüfe ob CI/CD-Pipeline existiert

---

## AUSGABEFORMAT

Erstelle die Datei `docs/COMPREHENSIVE_PROJECT_AUDIT.md` mit folgender Struktur:

```markdown
# SwingZ — Umfassender Projekt-Audit
**Datum:** [heute]
**Geprüft von:** AI Audit Agent

## Executive Summary
[Kurze Zusammenfassung der wichtigsten Funde — max 10 Bullet Points]

## Gesamtübersicht
| Bereich | Status | Kritisch | Warnung | OK |
|---------|--------|----------|---------|-----|
| Build & Kompilierung | ⚠️ | 0 | 2 | 10 |
| Dependencies & Sicherheit | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

## Detaillierte Funde

### 1. Build & Kompilierung
#### Kritisch (🔴)
- [Fund mit Datei:Zeile und Beschreibung]

#### Warnung (🟡)
- [Fund]

#### OK (🟢)
- [Was geprüft wurde und sauber ist]

### 2. Dependencies & Sicherheit
[gleiche Struktur]

[... für alle 14 Bereiche ...]

## Empfohlene Maßnahmen (priorisiert)
1. **Sofort (P0):** [Kritische Sicherheitslücken, Build-Breaker]
2. **Diese Woche (P1):** [Wichtige Fixes, fehlende Tests]
3. **Diesen Monat (P2):** [Performance, Code-Qualität]
4. **Backlog (P3):** [Nice-to-haves, Dokumentation]

## Anhänge
- TypeScript-Fehler-Vollständigliste
- npm audit Output
- Test-Ergebnisse
````

---

WICHTIG:

- Sei GRÜNDLICH — überspringe keinen Bereich
- Sei EHRLICH — dokumentiere auch Dinge die gut sind
- Sei KONKRET — immer mit Dateipfad und Zeilennummer
- Sei PRIORISIERT — kritische Sachen zuerst
- Arbeite Bereich für Bereich ab — nicht alles auf einmal
- Nutze Bash-Kommandos um tatsächliche Ergebnisse zu bekommen (tsc, build, lint, tests)

````

---

## Verwendung

1. Öffne eine neue Codebuff-Session
2. Kopiere den obigen Prompt (zwischen den ```-Blöcken)
3. Der Agent wird systematisch alle 14 Bereiche prüfen
4. Das Ergebnis landet in `docs/COMPREHENSIVE_PROJECT_AUDIT.md`

## Erwartete Dauer

- **15-25 Minuten** bei vollständiger Prüfung
- **5-10 Minuten** wenn nur Build + Security + Tests geprüft werden

## Nach dem Audit

Gehe die Empfohlene Maßnahmen-Liste durch und starte mit P0 (kritisch).
````
