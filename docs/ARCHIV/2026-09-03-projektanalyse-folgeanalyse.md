# Projektanalyse — 03.09.2026 (Folgeanalyse zur Analyse vom 31.08.)

> **Art:** Archiv-Snapshot. Dieser Bericht beschreibt den Zustand zum 3. September 2026 und wird
> nicht nachträglich gepflegt. Folgeprüfungen erhalten einen neuen datierten Bericht.
>
> **Prüfumfang:** Vollständige erneute Analyse aller Qualitätsdimensionen (Typecheck, Lint,
> Unit-/Integrationstests, Build, Formatierung, Dead Code, Abhängigkeitsaudit, Design-Tokens,
> Doku-Governance) plus Review der **ungemergten Änderungen im Arbeitsverzeichnis** (6 Dateien),
> die als Reaktion auf den Vorbericht [`2026-08-31-grundlegende-projektanalyse.md`](2026-08-31-grundlegende-projektanalyse.md)
> entstanden sind.
>
> **Wichtige Einschränkung:** Statische, lokal ausgeführte Analyse. Kein Zugriff auf die
> Produktionsdatenbank, keine Vercel-Settings, kein Stripe-Providerzustand. Sicherheitsbefunde
> zur DB müssen vor jeder Umsetzung gegen den Live-Zustand verifiziert werden
> (`docs/DATABASE.md` § Befehle).

---

## 1. Kurzfazit

Die ungemergten Änderungen im Arbeitsverzeichnis adressieren drei Befunde des Vorberichts
teilweise **richtig** (Strict-Typecheck, Stripe-Idempotenz fail-closed, Design-Tokens) —
der zentrale Statistik-Befund ist aber **nicht behoben**: der Test läuft weiter rot, weil der
Fix am falschen Berechnungspfad ansetzte. Zusätzlich hat der Umbau drei neue Lücken erzeugt:

1. Der neue fail-closed-Webhook-Pfad (503) hat **keine Testabdeckung**.
2. `components/layout/sidebar.tsx` nutzt `brand-primary-light` als Textfarbe auf hellen
   Hintergründen (`/10`-Alpha) — die vermutlich zu `--brand-light` verwies und im Theme ein
   heller Wert ist; im Light-Mode drohen Kontrastverletzungen.
3. Neu entdeckt: `pnpm audit --audit-level=high` liefert Exit 0, obwohl **4 HIGH-Schwachstellen**
   (fast-uri < 3.1.6) im Lockfile stehen — der CI-Abhängigkeits-Gate verfehlt real 4 HIGH-Befunde.

**Gesamtbewertung der Deltas seit 31.08.:** Richtung stimmt, Absicherung fehlt. Vor Merge:
Statistik-Logik korrigieren, Tests für den 503-Pfad ergänzen, Kontrast verifizieren,
fast-uri-Pin anheben.

---

## 2. Verifizierte Projektbasis

- 321 API-Route-Dateien, 122 Pages, Branch `main`, Arbeitsverzeichnis mit 6 geänderten Dateien
  (`git status`).
- Checks (lokale Ausführung, exakte Exit-Codes verifiziert):

| Prüfung                                    | Ergebnis  | Delta zum Vorbericht (31.08.)                                                                                  |
| ------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                         | ✅ Exit 0 | unverändert grün                                                                                               |
| `npx tsc --noEmit -p tsconfig.strict.json` | ✅ Exit 0 | **behoben** — `countOnly`-Parameter aus `src/__tests__/api/clubs.test.ts:241` entfernt (im Arbeitsverzeichnis) |
| `npm run lint`                             | ✅ Exit 0 | unverändert grün                                                                                               |
| `npx vitest run`                           | ❌ Exit 1 | **weiterhin rot** — 1.544 grün, 10 skip, **1 fail** (`statistics-dashboard.test.ts:922`)                       |
| `npm run format:check`                     | ❌ Exit 1 | unverändert: 39 Dateien (davon 23 `.ds-sync`/`.design-sync`-Vendor-Dateien)                                    |
| `npm run knip`                             | ❌ Exit 1 | größer als berichtet: **240 ungenutzte Exporte, 76 ungenutzte Typen, 7 doppelte Exporte**                      |
| `pnpm audit --audit-level=high`            | ⚠️ Exit 0 | **irreführend grün: 4 HIGH + 1 moderate** (fast-uri ≥3.1.3 <3.1.6) im Lockfile                                 |
| `npm run check:design`                     | ✅ Exit 0 | unverändert grün                                                                                               |
| `npm run docs:check`                       | ✅ Exit 0 | unverändert grün                                                                                               |

> Methodische Notiz zum Vorbericht: `format:check` meldet 39 Dateien, aber davon sind 23
> `.ds-sync`- und `.design-sync`-Dateien (Vendor-Artefakte eines Design-Sync-Tools, per
> `git ls-files` **getrackt**). Die echte Produktionscode-Reste sind deutlich kleiner —
> siehe § 6.3.

---

## 3. Review der ungemergten Änderungen (6 Dateien)

### 3.1 `src/application/services/statistics.service.ts` — Fix ist am falschen Pfad ❌

Die Änderung korrigiert `calculateMemberStatistics()` so, dass Numerator und Denominator der
Conversion-Rate aus **demselben Zeitraum** stammen (vorher: Numerator über alle Zeiträume,
Denominator im Zeitraum). Die fachliche Korrektur ist richtig.

Der rot schlagende Test (`statistics-dashboard.test.ts:922`) prüft aber
`getDashboardMetrics()`, und die dafür relevanten Mockdaten liegen nicht im Fenster, das
`getDashboardMetrics()` öffnet:

- `getDashboardMetrics()` rechnet mit `startOfMonth … now` (aktuelles Kalendermonat).
- Die 4 konvertierten Probetrainings im Mock wurden mit `createdAt = dp(12)`, `dp(17)`, `dp(22)`,
  `dp(27)` erzeugt — also 12 bis 27 Tage vor `now`. Das ist nur dann im aktuellen Monat, wenn
  der Test vor dem 12. des Monats läuft (Anfang September: 12. Tag wäre der 21.08. →
  außerhalb des 01.09-Fensters).
- Konsequenz: `totalTrials` im Zeitfenster kann 0 sein → `conversionRate = 0` →
  `expect(convMetric.value).toBeGreaterThan(0)` schlägt fehl.

Das erklärt auch, warum der Test historisch flaky/unstabil war: das Ergebnis hängt vom
Kalendertag der Ausführung ab. Zusätzlich testet der Test implizit ein anderes Geschäftsfragen-
Verständnis als `calculateMemberStatistics()` (der Fachtest dazu bei Zeile 621–628 besteht
weiterhin).

**Priorität: P1 — vor Merge zu beheben.** Zwei saubere Wege:

1. **Test treiben (empfohlen):** `getDashboardMetrics()` nicht mehr mit realer Wanduhr, sondern
   mit injiziertem/„gefrorenem" `now` rechnen (Parameter oder vitest `vi.setSystemTime()`),
   und die Mockdaten an festen relativen Tagen halten. Ergebnis ist deterministisch.
2. Alternativ die Mockdaten innerhalb des laufenden Monats clampsen (`createdAt` an
   `max(startOfMonth, now-…)` binden) — schlimmstenfalls weiterhin monatsabhängig.

Zusätzlich klarstellen (Kommentar im Test): Konvertierte Probetrainings zählen zum
Erhebungszeitpunkt ihres `createdAt`, nicht ihres Konvertierungszeitpunkts — das ist eine
fachliche Festlegung, die im Test explizit sein sollte.

### 3.2 `app/api/webhooks/stripe/route.ts` — Fail-closed korrekt, aber ungetestet ⚠️

Die Änderung dreht die Idempotenz von fail-open auf **fail-closed** (503 + Retry-Hinweis), statt
bei RPC-Fehler trotzdem zu verbuchen. Das ist sicherheitstechnisch richtig und deckt den
P0-Geldpfad des Vorberichts (§ 4.1/4.4) ab.

**Aber:**

- Es gibt **keinen Unit-/Integrationstest**, der diese Route abdeckt — kein Test für
  (a) „RPC schlägt fehl → 503", (b) „Event bereits vorhanden → deduplicated: true",
  (c) Signatur-Missing → 400. Die Route ist damit der sicherste Pfad im System und trotzdem
  die am schlechtesten abgesicherte.
- Streng genommen antwortet die Route jetzt auch dann mit 503, wenn der Fehler transient
  (Timeout, Netzwerkblip) ist — Stripe retried bei 503 mit Backoff, das ist gewollt und ok.
- Die `stripe_events`-Tabelle ist Vorbedingung. Nicht verifiziert: Existiert sie in Produktion?
  Vor dem Merge gegen Live-DB prüfen (`pg_policies`/`information_schema`), sonst wird bei
  Deployment jeder Webhook zum 503 und Zahlungen stehen.

**Priorität: P1 — Tests ergänzen, Tabellen-Existenz gegen Live-DB verifizieren.**

### 3.3 `components/layout/{sidebar,admin-section,role-switcher}.tsx` — Token-Umstellung fast sauber, ein Kontrastrisiko ⚠️

Umstellung von `info-*`/`brand-light`/`emerald` auf `brand-accent-2`/`brand-primary(-light)`/
`success`. `check:design` ist grün, die Tokens existieren (`tailwind.config.ts:42-53`).

**Ein Punkt verifizieren:**

- `text-brand-primary-light` wird im Light-Mode auf `bg-brand-primary/10` gesetzt
  (sidebar.tsx `admin`/`member`, role-switcher.tsx `admin`, admin-section.tsx `admin`).
  Der Token `brand-primary-light` war vorher als **Hintergrundfarbe** (`bg-brand-light`) im
  Einsatz, nicht als Textfarbe. Wenn `--brand-primary-light` ein heller Wert ist (Name legt das
  nahe), ist der Kontrast heller Text / fast-weißer Hintergrund im Light-Mode zu prüfen —
  im Dark-Mode ist der Swap plausibel (`dark:text-brand-primary-light`), im Light-Mode aber
  `text-brand-primary` greift.

Konkret im Code (sidebar.tsx, admin-section.tsx, role-switcher.tsx):

```tsx
bg: 'bg-brand-primary/10 dark:bg-brand-primary/20',
text: 'text-brand-primary dark:text-brand-primary-light',
```

Der Dark-Mode-Swap ist hier der plausible Teil; im Light-Mode greift `text-brand-primary` —
dort ist der Kontrast auf `/10`-Hintergrund mit dem finalen Brand-Farbton zu messen. Der
vorhandene `npm run contrast:check` ist die richtige Instanz — dort einmal für Sidebar/
Admin-Section/Role-Switcher laufen lassen.

**Priorität: P2 — einmal Kontrast messen, nicht per Nomenklatur raten.**

---

## 4. Neue Befunde (seit Vorbericht nicht erkannt)

### 4.1 `audit:ci` verfehlt 4 HIGH-Schwachstellen (fast-uri)

`pnpm audit --audit-level=high` meldet **4 HIGH** (SSRF/Host-Confusion in `fast-uri`, alle im
Range `>=3.0.0 <3.1.6`) und 1 moderate — beendet sich aber mit **Exit 0**. Die `audit:ci`-Gate
in CI schlägt also nicht an, obwohl das Lockfile verwundbare Versionen enthält. Vermutete
Ursache: die `pnpm.overrides` in `package.json` (u. a. `fast-uri: ^3.1.5`) fixen nur die
Top-Level-Version, nicht die transitiven.

**Fix:** Override auf `^3.1.6` anheben (oder `pnpm dedupe` nach Update), danach `pnpm install`
und verifizieren, dass der Audit-Exit 1 wird bevor der Fix greift — sonst war die_gate nie
scharf.

**Priorität: P1 — Supply-Chain-Risiko, direkt umsetzbar.**

### 4.2 Knip-Lage ist dramatischer als im Vorbericht berichtet

Der Vorbericht nannte 62 ungenutzte Exporte / 18 Typen / 7 Duplikate. Die aktuelle Zählung
(lokale Ausführung, `npx knip`) liegt bei **240/76/7**. Mögliche Ursache: vorab initiierte
Konfigurationsänderung an `knip.json`, die ein paar Einträge ausklammert. Egal welche Seite der
Unterschied kommt, die Zahl „62" ist veraltet und der Grad der toten öffentlichen API ist
beträchtlich. Beispielhafte Schwerpunkte:

- `components/ui/index.ts` — Barrel-Datei mit ~90 ungenutzten Re-Exports (shadcn/ui-Primitives).
- `components/ui/empty-state.tsx`, `components/ui/error-states.tsx` — definierte, nie genutzte
  Zustands-Komponenten (Empty/Success/Forbidden/Error).
- `lib/errors/database-errors.ts`, `src/domain/errors/index.ts` — ganze Fehlerklassen-Hierarchien
  ohne einen einzigen Referenzpunkt im Code.
- `lib/fetch-utils.ts` — Wrapper-Sammlung, nur Bruchteil genutzt.

**Priorität: P2 — Aufräumen, nicht ausklammern.** Vor jedem Aufräumen: Knip-Konfiguration
prüfen (ist `entry`-Menge konsistent?), dann in Domänen schneiden (UI-Primitive →
bewusst公开 lassen und konfigurieren; Fachcode → löschen).

### 4.3 Statistik-Dashboard-Route ist faktisch ungenutzt

`app/api/statistics/dashboard/route.ts` exponiert `getDashboardMetrics()`, aber **kein Frontend-
Code konsumiert die Route** (Suche nach `/api/statistics/dashboard` in `app/`, `components/`,
`lib/`, `src/` ohne Treffer außer der Route selbst und Tests). Die gerenderten Kennzahlen auf
dem Admin-Dashboard kommen nicht aus diesem Pfad.

Das hat zwei Konsequenzen:

1. Der rot schlagende Test (§ 3.1) schützt aktuell einen **Pfad, den kein Nutzer sieht** —
   der Business-Impact der roten Suite ist kleiner als im Vorbericht (P1 als
   „Dashboard kann falsche KPIs zeigen") angenommen.
2. Wenn die Route bleiben soll, sollte sie konsumiert werden oder die Metriken sollten an den
   echten Dashboard-Datenfluss angeschlossen werden. Wenn nicht: Route + Test löschen
   (stattdessen bleibt der Fachtest an `calculateMemberStatistics()`).

**Priorität: P2 — entscheiden (konsumieren oder entfernen), dann § 3.1 lösen.**

---

## 5. Bestätigte Vorbericht-Befunde (unverändert offen)

Die im Vorbericht dokumentierten P0/P1-Befunde sind weiter offen — hier nur Querverweis,
keine Wiederholung:

| Befund (Vorbericht §)                                   | Status 03.09.                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| SECURITY-DEFINER-Grants an `anon`/`authenticated` (4.1) | offen (Baseline, Live-Verifikation nötig)                                 |
| Drizzle-Service-Pfad mit BYPASSRLS (4.2)                | offen (`docs/OPEN_ITEMS.md` P0)                                           |
| DB-Transport unverschlüsselt (4.2/5.2)                  | offen (`docs/OPEN_ITEMS.md` P0)                                           |
| Nicht angewendete Migrationen (4.3)                     | offen (`docs/OPEN_ITEMS.md` P0/P1)                                        |
| Cron-Auth-Muster uneinheitlich (4.5)                    | offen                                                                     |
| `dangerouslyAllowSVG: true` (4.8)                       | offen                                                                     |
| `error.message`-Leaks in API-Responses (4.9)            | offen                                                                     |
| Rate-Limit fail-open + In-Memory-Fallback (4.7)         | offen; `console.warn` in `proxy.ts:219` weiterhin gegen Logger-Konvention |
| Statistikerhebungen im Node-Prozess statt in DB (8.4)   | offen                                                                     |
| Prettier 39 Dateien (10.3)                              | unverändert, siehe § 6.3                                                  |
| Vercel `ignoreCommand` ohne Preview-Gate (11.2)         | offen                                                                     |
| E2E-Smoke optional in CI (11.2)                         | offen                                                                     |

Neu prüfenswert (klein): `CLAUDE.md` nennt „~255 API-Routes" — aktuell sind es **321**. Der
Wert wird weder maschinell geprüft noch häufig genug gezogen. Der im Vorbericht vorgeschlagene
Inventory-Check würde das abdecken.

---

## 6. Optimierungsempfehlungen (konkret, priorisiert)

### 6.1 Vor Merge des Arbeitsverzeichnisses (P1)

1. **Statistik-Determinismus:** `getDashboardMetrics()` mit injizierbarem „jetzt" ausstatten
   (z. B. optionaler Parameter oder `vi.setSystemTime()` im Test) — der Test darf nicht mehr vom
   Kalendertag abhängen. Mockdaten fest relativ zu `now` halten.
2. **Webhook-Tests ergänzen:** mindestens 3 Cases für `app/api/webhooks/stripe/route.ts`
   (RPC-Fehler → 503, dedupe-Treffer → `deduplicated: true`, fehlende Signatur → 400).
3. **`stripe_events`-Existenz gegen Live-DB** prüfen — der neue 503-Pfad macht die Tabelle zur
   harten Vorbedingung.
4. **fast-uri-Override** auf `^3.1.6` anheben, `pnpm install`, Audit muss danach Exit 1→0
   zeigen (erst schlägt es an, dann grün — sonst war der Gate nie scharf).
5. **Kontrast-Check** für `text-brand-primary` auf `bg-brand-primary/10` im Light-Mode
   (`npm run contrast:check`, ggf. Screenshots beider Themes).
6. **Statistik-Route entscheiden:** konsumieren oder löschen. Bei Löschen entfällt auch der
   flaky Test.

### 6.2 Nach Merge (P2)

1. **Knip-Abbau in Domänen-Schnitten** (nicht in einem Riesen-PR):
   - UI-Primitive: bewusst behalten und in `knip.json` als öffentliche API whitelisten.
   - Fachcode (Fehler-Hierarchien, `fetch-utils`, unused Adapters): löschen.
   - Ziel messbar: `npm run knip` exit 0 oder dokumentierte, begründete Restliste.
2. **Prettier-Hygiene:** `.prettierignore` anlegen (fehlte zum Prüfzeitpunkt komplett):
   `.ds-sync/`, `.design-sync/`, `supabase/templates/`, `docs/ARCHIV/`, `docs/tickets/`,
   HTML-Artefakte. Danach die 16 verbleibenden echten Produktionsdateien formatieren
   (`scripts/*.mjs`, `app/not-found.tsx`,
   `src/infrastructure/persistence/repositories/system-settings.repository.ts`, …).
3. **Barrel-Datei `components/ui/index.ts`** evaluieren: mit 90+ Re-Exports vergrößert sie den
   Bundle- und Knip-Blast-Radius; direkte Imports je Komponente sind die sauberere Lösung.
4. **Konventionell-Review der unbewusst publizierten Datenpfade:** `GET /rest/v1/users` (P1 im
   Open-Items-Doku) bleibt der größte Privacy-Rest — im nächsten Release-Zyklus angehen.
5. **`docs/README.md`/`CLAUDE.md` Zahlen aktuell halten** (321 API-Route-Dateien, 122 Pages) —
   idealerweise über den im Vorbericht vorgeschlagenen Inventory-Check.

### 6.3 Prettier-Details (für die Umsetzung)

Die 39 Dateien verteilen sich so (Zählung 03.09.): **23 Vendor-Dateien** (`.ds-sync/*`,
`.design-sync/overrides/*`) und **16 echte**:

- `app/not-found.tsx`
- `docs/ARCHIV/FEHLERANALYSE-2026-05-03.md` (Archiv — ignorieren, nicht umbrechen)
- `docs/SwingZ — Farbvarianten.html`
- `docs/tickets/q2/q2.0.{1,3,4}-*.md`
- `scripts/check-contrast.mjs`, `scripts/detect-perf-regression.mjs`, `scripts/extract-bench-from-log.mjs`
- `src/infrastructure/persistence/repositories/system-settings.repository.ts`
- `supabase/templates/{confirmation,invite,magic_link,recovery}.html`
- `tests/e2e/mermaid-preview.html`

Empfohlene Aufteilung: 14 davon per `.prettierignore` (Vendor, Archiv, Tickets, HTML-Templates),
2 per `prettier --write` formatieren (`app/not-found.tsx`,
`src/infrastructure/persistence/repositories/system-settings.repository.ts`) — damit ist der
Check grün, ohne fremde Artefakte anzufassen.

---

## 7. Zusammenfassung als Arbeitsliste

| #   | Maßnahmen                                                               | Prio | Aufwand     |
| --- | ----------------------------------------------------------------------- | ---- | ----------- |
| 1   | Statistik-Metrik deterministisch machen (injected `now`), Mock anpassen | P1   | ~1–2 h      |
| 2   | Stripe-Webhook-Route: 3 Test-Cases (503/dedupe/400)                     | P1   | ~2 h        |
| 3   | `stripe_events`-Existenz + Policy gegen Live-DB verifizieren            | P1   | ~30 min     |
| 4   | fast-uri-Override `^3.1.6`, Audit-Gate verifizieren                     | P1   | ~30 min     |
| 5   | Kontrast-Check für neue Brand-Tokens im Light-Mode                      | P2   | ~30 min     |
| 6   | Statistik-Dashboard-Route: konsumieren oder entfernen                   | P2   | ~1 h        |
| 7   | `.prettierignore` + 2 Dateien formatieren → Check grün                  | P2   | ~30 min     |
| 8   | Knip: UI-Primitive whitelisten, Fachcode löschen                        | P2   | mehrere PRs |
| 9   | `proxy.ts:219` `console.warn` → `createLogger`                          | P3   | ~10 min     |
| 10  | Inventar-Zahlen in `CLAUDE.md` (321 Routes) prüfen/aktualisieren        | P3   | ~15 min     |

**Nicht in diesem Bericht behandelt, aber weiterhin P0 (siehe `docs/OPEN_ITEMS.md`):** DB-Grants
auf SECURITY-DEFINER-Funktionen, BYPASSRLS-App-Rolle, TLS auf dem Pooler, E-Mail-Domain-Verifikation
bei Resend, Subscription-Enforcement-Rückdrehung vor Launch.

---

## 8. Methodik

Alle Befunde wurden durch Ausführung verifiziert (nicht nur statisch gelesen):
`npx tsc --noEmit`, `npx tsc --noEmit -p tsconfig.strict.json`, `npm run lint`,
`npx vitest run`, `npx prettier --check .`, `npm run knip`, `pnpm audit --audit-level=high`,
`npm run check:design`, `npm run docs:check`. Code-Review per gezielter Suche
(`grep`/`git diff`) über die geänderten Dateien, die Webhook-Route, die Statistik-Route und die
Layout-Komponenten. Die Webhook-Route wurde vollständig gelesen (inkl. aller Handler), die
Statistik-Route bis auf Handler-Ebene. Es wurde kein Code geändert — der Arbeitsverzeichnis-
Stand wurde reviewt, nicht migriert.
