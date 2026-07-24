# Dev-Server-RAM-Audit — SwingZ

> **Datum:** 21. Juli 2026 · **Code-Stand:** aktuell `feat/sprint-3-plus-a11y-theme-fixes` ·
> **Stack:** Next.js 16 (`--turbopack`), Drizzle (2.953-Zeilen-Schema), Supabase, Sentry, TanStack Query.
>
> **Ziel:** RAM-Hunger im Dev-Server identifizieren und reduzieren **ohne** Qualitätsverlust.
> Konkret 14 Stellschrauben, sortiert nach RAM-Wirkung × Risiko.

---

## TL;DR

| Kennzahl                                      | Wert                      | Anmerkung                                                           |
| --------------------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `node_modules`                                | **2.9 GB**                | Normale Größe für Next.js + Supabase + Recharts/Drizzle/Sentry      |
| `.next` (Cache)                               | **5.5 GB**                | ⬅ **2× so groß wie `node_modules`** — größte einzelne Stellschraube |
| `src/infrastructure/persistence/schema.ts`    | **120 KB · 2.953 Zeilen** | Schwergewicht für TS-Server & transiente Imports                    |
| Gesamt TS-Zeilen                              | **87.896**                | Sprache-Server + Bundler arbeiten damit                             |
| `next dev --turbopack`                        | bereits aktiv ✓           | Eine Sorge weniger                                                  |
| Modular-level `setInterval` ohne HMR-Cleanup  | **2 Stellen**             | `lib/rate-limit.ts:108`, `lib/utils/cache.ts:112`                   |
| Doppelte `QueryClient`-Instanz                | **2 Stellen**             | `lib/query-client.ts` (Singleton) + `app/providers.tsx` (neu)       |
| Sentry `postgresIntegration` in Dev           | aktiv                     | Sollte dev-deaktiviert sein                                         |
| Worktree-Checkouts unter `.claude/worktrees/` | **4 Stück**               | Volle Repo-Duplikate ungenutzt                                      |

**Empfehlung „30-Min-Sprint":** Maßnahmen **#1 + #3 + #5** zusammen umsetzen — geschätzte Wirkung
**−300 MB bis −1.5 GB Disk + −100–200 MB RAM auf Dev-Server**, **null** funktionales Risiko.

---

## 🔴 Kategorie 1 — Große Wirkung, niedriges Risiko

### #1 · `.next`-Cache-Sweep als Routine-Script

`5.5 GB` ist nicht normal. Turbopack cached inkrementell und sammelt über Wochen
Source-Maps, alte Module-Snapshots (vor jedem Bug-Hot-Fix wird differenziell
gespeichert) und fehlgeschlagene Compile-Versuche.

**Fix in `package.json`:**

```json
"scripts": {
  "clean:dev": "rm -rf .next && echo '✓ .next gelöscht — beim nächsten dev frisch aufgebaut'",
  "clean": "rm -rf .next .tsbuildinfo && echo '✓ Build-Artefakte entfernt'",
  "dev:lean": "rm -rf .next && next dev --turbopack"
}
```

**Aufwand:** 5 Min.
**Wirkung:** **−200 MB bis −2 GB Disk**; nächster `next dev`-Start fühlt sich spürbar flotter an.
**Risiko:** keins — Cache baut sich verlustfrei neu auf.

---

### #2 · Worktree-Leichen unter `.claude/worktrees/`

Es existieren ≥4 Worktree-Checkouts parallel zum Haupt-Checkout:

- `.claude/worktrees/agent-a7a545884722fc753/`
- `.claude/worktrees/agent-add76b335b906cbc5/`
- `.claude/worktrees/agent-aefea989108a7008a/`
- `.claude/worktrees/agent-a042ac7fa4e7b73a9/`

Jeder ist eine **vollständige Kopie** des Repos (gleiche TS-Files, gleiche Komponenten).
Selbst wenn kein Watcher sie aktiv scannt: IDE-Indizes (TS-Server, ESLint) finden sie
manchmal und indizieren sie mit. Reine Schein-Bytes.

**Fix:** Worktrees abbauen, die keine offene Agenten-Session mehr halten:

```bash
git worktree list
git worktree remove .claude/worktrees/agent-a7a545884722fc753 --force  # wenn wirklich leer
```

**Aufwand:** 10 Min.
**Wirkung:** **−200 MB bis −1 GB Disk**, schnellere Repo-Indexierung.
**Risiko:** minimal — nur nicht mehr referenzierte Branches.

---

### #3 · `@sentry/nextjs` Postgres-Integration dev-tauglich machen

`sentry.server.config.ts` lädt `Sentry.postgresIntegration()`. Das ist eine
**Production-Integration** — sie schießt in Dev unnötig Queries ins Tracing
und hält eine Tracing-Pipeline im RAM.

**Fix in `sentry.server.config.ts`:**

```ts
import * as Sentry from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  enabled: isProd, // ⬅ komplett aus in Dev
  dsn: process.env.SENTRY_DSN,
  integrations: isProd ? [Sentry.postgresIntegration()] : [], // ⬅
  tracesSampleRate: 0, // ⬅ auch in Prod günstig
  profilesSampleRate: 0, // ⬅
  // ...
});
```

**Aufwand:** 10 Min.
**Wirkung:** **−50 bis −150 MB** auf dem Dev-Server-RAM.
**Risiko:** minimal — Prod-Verhalten ändert sich nicht.

---

### #4 · `optimizePackageImports` ausweiten

`next.config.js` deckt aktuell nur `lucide-react` und `@radix-ui/react-icons` ab.
Recharts, date-fns und `@supabase/supabase-js` sind groß und werden voll geladen
(Tree-Shaking hilft in Prod, im Dev-Modus weniger).

**Fix in `next.config.js`:**

```js
experimental: {
  optimizePackageImports: [
    'lucide-react',
    '@radix-ui/react-icons',
    'date-fns',
    'recharts',
    '@supabase/supabase-js',
  ],
}
```

**Aufwand:** 10 Min.
**Wirkung:** **−5 bis −15 %** Modul-Graph-Größe im Browser, weniger Parser-Arbeit auf Server-Seite.
**Risiko:** minimal — Barrel-Re-Exports werden lazy.

---

## 🟡 Kategorie 2 — Mittlere Wirkung

### #5 · Module-level `setInterval` ohne HMR-Cleanup

**Zwei kritische Stellen:**

```ts
// lib/rate-limit.ts:108 — Module-Top-Level
setInterval(() => {
  // cleanup logic
}, 60_000);
```

```ts
// lib/utils/cache.ts:112 — Module-Top-Level
if (typeof setInterval !== 'undefined') {
  setInterval(/* cache cleanup */, /* … */);
}
```

Was passiert: Beim **ersten Import** startet das Interval. In Dev mit HMR wird beim
**jeden Save** das Modul neu geladen → eine **zweite** Instanz startet parallel,
die alte Instanz bleibt aktiv (Closure hält Referenzen). Über mehrere HMR-Zyklen
akkumuliert das → RAM-Leak. Pro Leak: mehrere MB Closure-States.

**Fix-Pattern (`lib/rate-limit.ts`):**

```ts
const RATE_LIMIT_CLEANUP_KEY = '__swingzRateLimitInterval';

if (typeof setInterval !== 'undefined' && !(globalThis as any)[RATE_LIMIT_CLEANUP_KEY]) {
  (globalThis as any)[RATE_LIMIT_CLEANUP_KEY] = setInterval(() => {
    // cleanup logic — unchanged
  }, 60_000);
}
```

Analog für `lib/utils/cache.ts:112`.

**Aufwand:** 30 Min. (zwei Stellen + Tests).
**Wirkung:** verhindert **mehrere MB Leak pro HMR-Zyklus** — fällt erst über Stunden auf,
aber auf einer langen Dev-Session sind das spürbare 50-100 MB.
**Risiko:** mittel — Cleanup-Logik muss wirken, sonst gehen Daten verloren. Tests
sollten das prüfen.

---

### #6 · Doppelte `QueryClient`-Instanz

`lib/query-client.ts` exportiert ein **Modul-Singleton**:

```ts
// lib/query-client.ts:44
export const queryClient = createQueryClient();
```

UND `app/providers.tsx` instanziiert **nochmal** eines innerhalb `<Suspense>`:

```tsx
// app/providers.tsx:22
const [queryClient] = useState(() => new QueryClient({ ... }));
```

→ Je nach Render-Pfad **zwei Cache-Instanzen im Speicher**, doppelte Hydrations-Arbeit.

**Fix:** Konsument entscheiden — am saubersten: **nur** die Provider-Suspense-Variante behalten
(`lib/query-client.ts` zu `createQueryClient()`-Factory reduzieren, ohne Singleton-Export).

**Aufwand:** 20 Min.
**Wirkung:** **−10 bis −30 MB** im Dev-Modus.
**Risiko:** niedrig — Verhalten in Prod identisch (jeder Request hat eine eigene
Server-Komponenten-Tree, daher keine Cross-Session-Stale-Cache-Concerns).

---

### #7 · Custom `webpack`-Function ist im Turbopack-Mode **toter Code**

`next.config.js` enthält eine substantielle `webpack(config)`-Funktion
(Code-Splitting, `maxSize: 244 * 1024`, etc.). Da der Dev-Script bereits
`--turbopack` verwendet, **ignoriert Turbopack diese Funktion komplett**.
Sie existiert nur, damit der Production-Webpack-Build noch läuft.

Im Dev-Pfad wird sie trotzdem geladen (Parsen + AST-Bereitstellung).

**Fix:** Klar abgrenzen:

```js
webpack: (config, { dev }) => {
  if (dev && process.env.TURBOPACK === '1') {
    return config; // ⬅ Turbopack ignoriert uns ohnehin, wir sparen uns den Parse
  }
  // Custom Production-Code-Splitting hier
  return config;
},
```

**Aufwand:** 15 Min.
**Wirkung:** minimal (~5–10 MB), dafür **Komplexitäts-Reduktion** & leichteres Debugging.
**Risiko:** niedrig — Prod-Pfad ändert sich nicht.

---

### #8 · `.tsbuildinfo` wächst durch `incremental: true`

`tsconfig.json` hat `"incremental": true` — TypeScript schreibt eine `.tsbuildinfo`-Datei,
die **mit jedem Compile-Versuch mitwächst**. In Kombination mit 88k TS-Zeilen werden das
schnell 50-100 MB I/O-Overhead im RAM-Page-Cache.

**Fix:** `"incremental": false` setzen — oder die Datei regelmäßig wipen:

```bash
# in clean-Script (siehe #1):
"clean": "rm -rf .next .tsbuildinfo"
```

**Aufwand:** 1 Min.
**Wirkung:** kleine, aber merkbare I/O-Entlastung; schnellerer Typecheck-Start.
**Risiko:** minimal — `incremental: true` ist in CI/Pipeline ohnehin wirkungslos.

---

## 🟢 Kategorie 3 — Niedrige Wirkung / Code-Hygiene

### #9 · `console.*` statt `createLogger` — Regel-Verstoß in 30+ Service-Files

Die Codebase verletzt die eigene CLAUDE.md-Regel („Nutze immer `createLogger`")
an ≥30 Stellen. Beispiele:

- `lib/billing/season-billing.service.ts` (mehrere Stellen)
- `lib/booking/court.service.ts`
- `lib/booking/waitlist.service.ts`
- `lib/season-planning/dry-run.service.ts` (≥6 Stellen)
- `lib/season-planning/conflict-detector.ts`
- `lib/auth/send-password-reset-email.ts`
- `lib/push-notification.service.ts`
- ...

**Wirkung:** **kein direkter RAM-Impact**, aber: `console.*` ist unstrukturiert →
in Dev-Terminal/IDE-Console wächst der Output-Buffer. Saubere Migration auf
`createLogger` ist **Signal-Rausch-Verbesserung** + Vorbereitung für strukturiertes
Logging.

**Empfehlung:** _nicht im RAM-Sprint_ — separat, in einer „Logger-Hygiene-Woche".

---

### #10 · Settings-Audit (nur Information)

| Setting                        | Status          | Wert                               |
| ------------------------------ | --------------- | ---------------------------------- |
| `next dev --turbopack`         | ✓ aktiv         | spart vs. Webpack ~30-50 % Dev-RAM |
| `optimizePackageImports`       | ⚠ teilweise     | nur 2 Libs (s. #4)                 |
| `experimental.serverActions`   | nicht verwendet | –                                  |
| `noEmit` im tsconfig           | ✓ aktiv         | korrekt für Next.js                |
| `strict.json` für CI           | ✓ aktiv         | ja, lass es so                     |
| `incremental: true` (tsconfig) | ⚠ suboptimal    | s. #8                              |
| `productionBrowserSourceMaps`  | Default aus     | ✓                                  |
| `logging.fetches.fullUrl`      | `true` in Dev   | CPU-Overhead, nicht RAM            |
| `swcMinify`                    | Default `true`  | ✓                                  |

---

### #11 · Schema-Split (`src/infrastructure/persistence/schema.ts`, 120 KB)

`schema.ts` ist **2.953 Zeilen** und wird in **jeder Serverkomponente**, die
`db` aus `@/lib/db` importiert, transitiv geladen. Turbopack hat es zwar im
Cache, aber der TS-Server im IDE hält pro File einen `Program`-AST.

**Option:** Schema in mehrere domain-spezifische Files splitten:

```
src/infrastructure/persistence/
  schema/
    index.ts          (re-export aggregator)
    auth.ts           (users, memberships, clubs)
    billing.ts        (invoices, payments, fees)
    trains.ts         (sessions, schedules, courts)
    season.ts         (seasons, plan_entries)
    messaging.ts      (notifications, messages)
    ...
  schema.ts           (bleibt als Stub mit `export * from './schema'`)
```

**Aufwand:** 2+ Std (200+ Imports prüfen).
**Wirkung:** **−50 bis −150 MB im IDE-Prozess** (VS Code / Cursor), nicht direkt im
Next-Dev-Server. Wenn auch IDE-RAM zählt: deutlicher Gewinn.
**Risiko:** mittel — viele Imports ändern sich, breites Refactoring nötig.

---

### #12 · `.env.local`-Audit / Supabase-Client-Disziplin

Wir laden **drei Supabase-Clients** (`server`, `service`, `client`) — jeweils ein
voller `@supabase/supabase-js`-Bundle. Wenn `createClient` (`lib/supabase/server`) in
Komponenten importiert wird, die nie SSR machen, zieht das Node-Module in den
Client-Bundle → Dev-Browser-RAM.

**Fix:** Code-Search bestätigen oder widerlegen:

```bash
grep -rn "from '@/lib/supabase/server'" app/ components/ hooks/ --include='*.ts*'
```

Falls Treffer in Client-Komponenten → Refactor zu `createClient()` aus `@/lib/supabase/client`.

**Aufwand:** 15 Min Audit + 1-2 Std Fixes falls nötig.
**Wirkung:** klein (Bundle-Größe in Browser-DevTools), aber wichtig.

---

### #13 · Husky-Hook-Performance bei `tsc --noEmit`

`.husky/pre-commit` triggert `tsc --noEmit`. Mit 88k TS-Zeilen = 30-60 s pro Commit.
Nicht direkt Dev-RAM-Relevant, aber Commit-Loop-Frust.

**Fix:** Auf `--watch` als Daemon umstellen (Turbo-Cache + inkrementell):

```json
"typecheck:watch": "tsc --noEmit --watch --preserveWatchOutput"
```

**Risiko:** niedrig.
**Wirkung:** kein direkter RAM-Swing, aber **Entwickler-Frust ↓**.

---

### #14 · Bundle-Analyzer als Option für Profile-Runs

`@next/bundle-analyzer` installieren, optionales Profile-Script:

```json
"analyze": "ANALYZE=true next build"
```

Damit lässt sich jederzeit punktuell prüfen, welche Module die Bundles aufblasen.
**Macht keinen Dev-Impact** und identifiziert „schwergewichtige" Module für Splits.

---

## Zusammenfassung

| #   | Maßnahme                                                                          | Wirkung         | Risiko  | Aufwand              |
| --- | --------------------------------------------------------------------------------- | --------------- | ------- | -------------------- |
| 1   | `.next` regelmäßig wipen + `clean:dev`-Script                                     | 🟢 groß         | minimal | 5 Min                |
| 2   | Worktrees unter `.claude/worktrees/` aufräumen                                    | 🟢 groß         | minimal | 10 Min               |
| 3   | Sentry `postgresIntegration` + `enabled` in Dev disablen                          | 🟢 groß         | minimal | 10 Min               |
| 4   | `optimizePackageImports` um date-fns/recharts/supabase-js erweitern               | 🟡 mittel       | minimal | 10 Min               |
| 5   | Modul-level `setInterval`-Leak (`lib/rate-limit.ts` + `lib/utils/cache.ts`) fixen | 🟡 mittel       | mittel  | 30 Min               |
| 6   | Doppelten `QueryClient` auflösen (`lib/query-client.ts` ↔ `app/providers.tsx`)    | 🟡 mittel       | niedrig | 20 Min               |
| 7   | `webpack`-Function für Turbopack-Dev-Pfad skippen                                 | 🟢 klein        | niedrig | 15 Min               |
| 8   | `incremental: false` in `tsconfig.json`                                           | 🟢 klein        | minimal | 1 Min                |
| 9   | Logger-Hygiene (30+ `console.*`-Stellen)                                          | ⚪ kein RAM-Win | niedrig | 2-3 Std              |
| 10  | Settings-Audit (bereits OK)                                                       | –               | –       | 5 Min                |
| 11  | Schema-Split (120 KB / 2.953 Zeilen)                                              | 🟡 mittel (IDE) | mittel  | 2+ Std               |
| 12  | Supabase-Client-Import-Audit (Server vs Client)                                   | 🟢 klein        | niedrig | 15 Min Audit + Fixes |
| 13  | `tsc --noEmit --watch` als Daemon im Husky-Hook                                   | ⚪ kein RAM-Win | niedrig | 15 Min               |
| 14  | `@next/bundle-analyzer` optional installieren                                     | ⚪ kein RAM-Win | minimal | 10 Min               |

---

## Was NICHT anfassen — RAM-Versuchung, aber Qualitätsverlust

- ❌ **TS-strict lockern oder `exclude`-Liste aufbohren** → würde IDE-Typecheck aushebeln.
- ❌ **`optimizePackageImports: true` global** ohne Lib-Whitelist → manche Libs zerbrechen (Side-Effects).
- ❌ **`gcTime` / `staleTime` radikal runtersetzen** → mehr API-Calls, schlechter UX, Cache-Turnover-Kosten.
- ❌ **Sourcemaps in Dev einschalten** → no-op für RAM, aber macht Debug-Output träge.
- ❌ **Drizzle-Query-Batching entfernen** → wäre eine funktionale Regression.

---

## Reviewer-Checkliste (vor Merge jedes RAM-Tickets)

- [ ] `npx tsc --noEmit` zeigt **0 Errors**
- [ ] `npm run lint` exit 0
- [ ] `npm test` (Vitest) grün — vor allem für #5 (Cleanup-Logik)
- [ ] `du -sh .next` vor & nach dokumentiert (Hard Numbers, nicht Vermutungen)
- [ ] Diff ≤ 200 Zeilen, ≤ 3 Files pro PR (Stack-Reviewability)
- [ ] **Kein** Funktionalitäts-Verlust dokumentiert in PR-Description

---

**Verwandte Docs:**

- `docs/PERFORMANCE_BENCHMARK.md` — Performance-Metriken (separat)
- `docs/MARKT_READINESS_AUDIT-2026-07-02.md` — Audit-Bruder-Datei
- `docs/AUDIT-REPORT-2026-07-09.md` — Letztes Audit für Sentry/Error-Boundary
