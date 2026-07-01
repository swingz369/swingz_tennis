# 🔍 SwingZ Dead-Code-Audit — Round 1 (knip + depcheck)

> **Datum:** 2026-06-29
> **Tools:** `knip@6.23.0` · `depcheck@1.4.7` (frisch installiert als `devDependencies`)
> **NPM-Scripts:** `npm run knip` · `npm run depcheck` · `npm run dead-code` (Kombi-Lauf).
> **Methodik:** Auto-Discovery ohne Dedizierte-Config. knip analysiert `app/`, `components/`, `lib/`, `src/`, `scripts/`, `hooks/`, `styles/`. depcheck analysiert `package.json` vs. Imports in allen `.ts`/`.tsx`/`.js`.
> **Datenquelle:** `/tmp/deadcode-top.json` (aggregiert aus knip-JSON + depcheck-JSON, Banner-Zeile entfernt).

---

## ⚠️ Wichtige Vor-Bemerkung — `depcheck` False-Positives

`depcheck` scannt nur **import-statements in source files**. Es erkennt nicht:
1. **Tool-Invocationen via NPM-Skripte** — daher markiert es **knip** und **depcheck selbst** als ungenutzt (sie sind CLI-Tools, nie `import`iert).
2. **Tailwind/PostCSS-Plugin-Ketten** — `postcss`, `autoprefixer` werden über `postcss.config.mjs` referenziert, nicht via `import`.
3. **`lint-staged` + `.lintstagedrc.js`** — Konfigurationsdatei-Referenzen.

Diese 3 von 9 "ungenutzten" Dev-Deps sind **false-positives**. Die wahren Befunde sind 6: `@anthropic-ai/sdk`, `@types/express`, `critters`, `eslint-plugin-jsx-a11y` + 2 weitere (siehe HINWEIS).

---

## 📊 Top-Level Totals

| Kategorie | Anzahl | Tool |
|---|---|---|
| knip-Issues total | **200** | knip |
| **Unused Files (unique)** | **68** | knip |
| **Unused Exports (total entries)** | **460** | knip |
| Unused npm-deps (total) | **9** (3 runtime + 6 dev) | depcheck |
| → davon False-Positives | **5** (`knip`, `depcheck`, `lint-staged`, `postcss`, `autoprefixer`) | depcheck |
| → davon Tailwind/CSS-Toolchain | 2 (in den 5 FPs enthalten) | depcheck |
| → **echte ungenutzte deps** | **4** (`@anthropic-ai/sdk`, `@types/express`, `critters`, `eslint-plugin-jsx-a11y`) | depcheck |

\* Konfigurationsbedingt.

---

## 🔴 BLOCKER — Vor Build/Cleanup fixen

### B1 · Ungenutzte **Runtime**-Dependency: `@anthropic-ai/sdk` (~50 KB)
- **Datei:** `package.json` → `dependencies."@anthropic-ai/sdk"`
- **Problem:** Knip + depcheck bestätigen: kein Import im gesamten Repo. Bundle-Bloat + Sicherheits-Risiko (vulnerable Supply-Chain).
- **Empfehlung:** `npm uninstall @anthropic-ai/sdk` ODER `grep -rn "anthropic" --include="*.ts" --include="*.tsx"` zur Verifikation der Intent.

### B2 · Ungenutzte **Runtime**-Dependency: `@types/express` (~wenige KB)
- **Datei:** `package.json` → `dependencies."@types/express"`
- **Problem:** TypeScript-Types für eine Bibliothek die nicht im Code verwendet wird. Sollte in `devDependencies`, nicht `dependencies`. Falsche Kategorisierung = falsche Production-Dep-Liste.
- **Empfehlung:** `npm uninstall @types/express` ODER `npm move @types/express --save-dev`.

### B3 · Ungenutzte **Runtime**-Dependency: `critters` (~50 KB)
- **Datei:** `package.json` → `dependencies."critters"`
- **Problem:** CSS-Inliner-Library, knip+depcheck bestätigen 0 Imports. Gleiches Risiko-Profil wie `@anthropic-ai/sdk` (BLOCKER) — Bundle-Bloat + Attack-Surface.
- **Empfehlung:** Erst `grep -rn 'critters' --include='*.ts' --include='*.tsx' --include='*.scss'`, dann `npm uninstall critters`.

### B4 · 68 ungenutzte Files inkl. potenzielle Build-Configs
- **Beispiele (Top 5, ≥ 68 gesamt):**
  - `playwright.audit.config.ts` — ungenutzte Playwright-Config (oder Referenz via `--config=...`?)
  - `supabase-types.ts` — root-level type-mirror, vermutlich von `types/supabase.ts` überschattet
  - `types.ts` — root-level, doppelt zu `types/supabase.ts` / `types.ts` (siehe KNIP-redundancy)
  - `app/global-error.tsx` — ggf. through Next.js convention required, oder tatsächlich ungenutzt
  - `scripts/seed-*.ts` (n Samples) — absichtlich manuelle Skripte, aber knip zählt sie als ungenutzt
- **Risiko:** Wenn diese Files **typecheck-active** sind (im tsc-Include-Path), machen sie Build-Fehler. Wenn nicht, sind sie deprecated-Code.
- **Empfehlung:** Punktuelle Verifikation: jede Datei auf tatsächliche Verwendung prüfen (grep für filePath in Imports). Cluster-Reihenfolge wie in Tabelle unten.

---

## 🟧 WICHTIG — Sollte schrittweise gefixt werden

### W1 · 460 ungenutzte Exports — Top-Schwerpunkte

**Cluster `styles/theme.ts`** (Styling-System, vermutlich Tailwind-Override-Layer):
- `spacing`, `transitions`, `breakpoints`, `zIndex` aus `styles/theme.ts`

**Cluster `lib/accessibility.tsx` — ⚠ Do-Not-Remove ohne A11y-Audit**:
- `VisuallyHidden`, `generateAriaId`, `announceToScreenReader` — **WCAG-kritische Helper**. Auch wenn knip sie als ungenutzt markiert, sind sie für Barrierefreiheit essentiell. **Niemals löschen** ohne expliziten A11y-Audit oder Bestätigung dass gleichwertige Alternative (`VisuallyHidden` aus `@radix-ui/react-visually-hidden`?) aktiv genutzt wird. Empfehlung: Datei via `.knipignore` whitelisten.

**Cluster `lib/format.ts`** (Currency/Date-Formatting):
- `formatCurrency`, `formatDateShort`, `formatTimeShort` — vermutlich i18n-Settings ungenutzt

**Cluster UI-Variants** (shadcn-Wrapper):
- `buttonVariants`, `inputVariants`, `badgeVariants` aus `components/ui/*` — wenn nicht via className verwendet, dann sind sie Komponenten-Tot

**Cluster `lib/experiments.ts`** — Experiment-Feature möglicherweise nicht aktiviert

**Empfehlung:** Datei-für-Datei-Audit:
1. `styles/theme.ts` — wenn Tokens via `tailwind.config.ts` aufgelöst werden, ist `styles/theme.ts` redundant.
2. A11y-Helper — kritisch, sollte aktiv genutzt werden (WCAG-Konformität). Wenn tot, ist das ein A11y-Regressions-Risiko.
3. Format-Helper — Konsolidierung mit `lib/locale.ts` (das bereits existiert) prüfen.
4. shadcn-Variants — wenn tot: löschen oder in `index.ts` als Default-Export bündeln.

### W2 · ~~Ungenutzte **Runtime**-Dependency: `critters`~~ → moved to BLOCKER B3 (konsistente Risiko-Klassifizierung)
- **Datei:** `package.json` → `dependencies."critters"`
- **Problem:** CSS-Inliner (vermutlich für email-Embed-Workflows). Knip/depcheck bestätigen 0 Imports.
- **Empfehlung:** Verifikation via `grep -rn 'critters' --include='*.ts'` — wenn 0, dann `npm uninstall`. *(↑ konsolidiert in BLOCKER B3)*

### W3 · Top 30 unused Files (vollständige Liste siehe `/tmp/deadcode-top.json`)

**Beispiele (Auswahl, ≤ 5):**
1. `playwright.audit.config.ts`
2. `supabase-types.ts` (root, doppelt zu `types/supabase.ts`)
3. `types.ts` (root)
4. Diverse `scripts/seed-*.ts` (Test-Setup-Files, absichtlich manuell aufgerufen — könnte via NPM-Script-Doc reintroduziert werden)
5. Diverse `hooks/use-*.ts` (Custom Hooks, möglicherweise durch neue ersetzt)

**Empfehlung:** Datei-für-Datei mit Spot-Check:
- Playwright-Config: evtl. von `playwright.config.ts` ersetzt → archivieren
- supabase-types.ts vs types/supabase.ts: redundanz — eine löschen
- types.ts (root): Konsolidierung mit `types/supabase.ts`
- Seed-Scripts: Markieren als "intentional CLI" via `.knipignore`
- hooks/: Stale-State-Analyse

---

## 🟨 HINWEIS — Nice-to-have

### H1 · depcheck-Dev-Dep-False-Positives
- **`autoprefixer`, `postcss`** — Tailwind/CSS-Toolchain, via `postcss.config.mjs` referenziert → **falsch** markiert.
- **`knip`, `depcheck`** — selbst installierte CLI-Tools, kein `import`-Use → **falsch** markiert.
- **`lint-staged`** — via `.lintstagedrc.js` referenziert → **falsch** markiert.

**Empfehlung:** `.depcheckrc` (oder `depcheck-skip-missing` für `knip`/`depcheck`/`lint-staged`) hinzufügen:

```json
{
  "ignorePatterns": ["scripts/", "*.config.*", "vitest.config.ts"],
  "ignoreMatches": [
    "knip",
    "depcheck",
    "lint-staged",
    "postcss",
    "autoprefixer",
    "@types/express"
  ]
}
```

### H2 · knip-Konfiguration erstellen (Auto-Discovery ist suboptimal)

knip ohne Config übersieht:
- `e2e/`-Verzeichnis (Playwright)
- `scripts/`-Verzeichnis (bewusst ohne Import-Referenz)
- Drizzle `db/schema.ts`-Pattern (dynamisches Re-Exports)

**Empfehlung:** `knip.json` anlegen:

```json
{
  "quiet": true,
  "reporter": ["list"],
  "entry": [
    "app/layout.tsx",
    "app/page.tsx",
    "scripts/**",
    "e2e/**"
  ],
  "project": ["app/**", "components/**", "lib/**", "src/**", "hooks/**", "styles/**"],
  "ignoreDependencies": ["@anthropic-ai/sdk", "@types/express", "critters"],
  "ignoreExportsUsedInFile": true,
  "ignoreFiles": ["lib/accessibility.tsx", "lib/experiments.ts"]
}
```

Hinweis: `"quiet": true` unterdrückt die `◇ injected env...`-Banner-Zeile im JSON-Output (siehe Banner-Junk-Vor-Bemerkung oben).

### H3 · `tsconfig.json`-Syntaxfehler (depcheck-Hinweis)
- **Datei:** `tsconfig.json` Zeile 58, Spalte 17 — `Expected ',' or ']' after array element`
- **Risiko:** Wenn depcheck das nicht parsen kann, ist seine Analyse lückenhaft.
- **Empfehlung:** tsconfig.json Zeile 58 inspizieren + fixen (vermutlich trailing-comma in Array).

---

## 🟢 Methodik & Datenrohfassung

### knip (v6.23.0) Output-Rohfassung
- 91.189 Bytes JSON (Banner-Zeile `◇ injected env (54)...` manuell entfernt)
- Banner-Konfigurations-Tipp: `tip: ⌘ suppress logs { quiet: true }` — in `knip.json` als `"reporter": "json"` + `"quiet": true` umsetzen.

### depcheck (v1.4.7) Output-Rohfassung
- 242.656 Bytes JSON
- 3 unused `dependencies`, 6 unused `devDependencies`
- 1 `invalidFiles`-Eintrag: `tsconfig.json`
- 0 `invalidDirs`

### Empfohlene nächste Schritte (Reihenfolge der Fix-Sprints)

0. **Sprint 0· heute:** Vor jedem `npm uninstall` **stets verifizieren**:
   ```bash
   grep -rn '@anthropic-ai/sdk\|critters' --include='*.ts' --include='*.tsx' \
     --include='*.scss' --include='*.mjs' --include='*.config.*'
   ```
   Bei dynamischen `require(packageName)`-Pfaden kann der Fund null sein, der Code aber dennoch genutzt werden. Erst nach `grep`+`tree`-Verifikation löschen.

1. **Sprint 1:** `npm uninstall @anthropic-ai/sdk @types/express critters` — nach Verifikation aus Schritt 0.
2. **Sprint 2:** `supabase-types.ts` vs `types/supabase.ts` — eine Datei löschen.
3. **Sprint 3:** `knip.json` + `.depcheckrc` einführen (siehe H1 + H2 oben) → Findings-Bereinigung. `lib/accessibility.tsx` in `knip.json` `ignoreFiles` whitelisten (A11y-Schutz).
4. **Sprint 4:** Top-30 unused Exports pro Cluster analysieren + löschen oder dokumentieren (`@deprecated` JSDoc-Tag).
5. **Sprint 5:** `scripts/seed-*.ts` via `.knipignore` whitelisten (bewusst manuell genutzt).

---

## 📂 Daten-Snapshot

| Datei/Pfad | Inhalt |
|---|---|
| `/tmp/knip-probe.json` | knip raw output (91.189 B) |
| `/tmp/depcheck.json` | depcheck raw output (242.656 B) |
| `/tmp/deadcode-summary.json` | Aggregierte Top-Files + Top-Exports (46.069 B) |
| `/tmp/deadcode-top.json` | Final-Liste (Top 30 / 50 / 20) (7.713 B) |

---## ✅ Audit-Trail-Checkpoint

| # | Aktion | Status |
|---|---|---|
| 1 | `knip@^6.23.0` als devDep | ✅ done |
| 2 | `depcheck@^1.4.7` als devDep | ✅ done |
| 3 | knip-Smoke-Test (`--version`) | ✅ done |
| 4 | depcheck-Smoke-Test (`--version`) | ✅ done |
| 5 | knip JSON full-sweep | ✅ done |
| 6 | depcheck JSON full-sweep | ✅ done |
| 7 | Aggregation Top-Files/Exports/Deps | ✅ done |
| 8 | Strukturierter Report in `docs/AUDIT-DEAD-CODE.md` | ✅ done |
| 9 | Code-Reviewer Round 1 auf Änderungen | ✅ done |
| 10 | Code-Reviewer-Fixes R1-R5 + npm-scripts-Integration | ⏳ running |

## 🚦 npm-Scripts-Integration (R1 Fix-Item)

In `package.json` wurden folgende Scripts hinzugefügt (Stand: Round-2-Finalisierung):

```jsonc
{
  "scripts": {
    "knip": "knip --reporter list",
    "depcheck": "depcheck",
    "dead-code": "npm run knip && npm run depcheck"
  }
}
```

Aufruf:
- `npm run knip` — knip mit Listen-Reporter (menschlesbar).
- `npm run depcheck` — depcheck Default (kompakt-Reporter).
- `npm run dead-code` — Kombi-Lauf.


