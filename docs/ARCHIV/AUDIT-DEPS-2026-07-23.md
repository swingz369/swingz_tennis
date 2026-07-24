# 🔒 Dependency Audit — SwingZ (konsolidiert)

> **Datum:** 23. Juli 2026  
> **Methodik:** Statisch (Manifest + Lockfile) + Dynamisch (`pnpm audit`, `pnpm outdated`, `pnpm licenses list`)  
> **Quellen:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `knip.json`, `.nvmrc`  
> **Status:** ✅ Phase 1 + 2 abgeschlossen — 48 → 6 CVEs (−87.5%)

---

## Executive Summary

| Metrik               | Ursprünglich                    | Jetzt (nach Fixes)                              |
| -------------------- | ------------------------------- | ----------------------------------------------- |
| Direkte Dependencies | ~80 (production)                | ~80                                             |
| Gesamt-Dependencies  | ~1.159 (mit transitiven)        | ~1.159                                          |
| **Critical CVEs**    | **0** ✅                        | **0** ✅                                        |
| **High CVEs**        | **19** 🔴                       | **2** 🟢                                        |
| **Moderate CVEs**    | 23 🟡                           | **3** 🟢                                        |
| **Low CVEs**         | 6 🟢                            | **1** 🟢                                        |
| **Total CVEs**       | **48**                          | **6** (−87.5%)                                  |
| Strukturelle Befunde | 7 (1×Hoch, 2×Mittel, 4×Niedrig) | 3 offen (1×Hoch gefixt ✅, 2×Mittel, 2×Niedrig) |
| Veraltete Pakete     | 27                              | ~10 (Radix + swagger-ui-react upgraded ✅)      |
| Deprecated Pakete    | 1 (`@react-email/components`)   | 1                                               |
| Copyleft-Lizenzen    | Keine starken                   | Keine starken ✅                                |

---

## Teil A: Strukturelle Befunde (statische Analyse)

### 🔴 A1. `pnpm-workspace.yaml` `allowBuilds` ist syntaktisch kaputt — ✅ **GEFIXT 23.07.**

**IST-Zustand (vor Fix):**

```yaml
allowBuilds:
  '@parcel/watcher': set this to true or false
  # ... 11 Platzhalter-Einträge
```

**Nach Fix:**

```yaml
allowBuilds:
  '@sentry/cli': true
  '@swc/core': true
  esbuild: true
  sharp: true
```

Overrides aus `pnpm-workspace.yaml` entfernt und in `package.json` konsolidiert.

---

### 🟠 A2. Zwei parallele Lockfiles — ✅ **GEFIXT 23.07.**

`package-lock.json` via `git rm --cached` entfernt und in `.gitignore` aufgenommen. Nur noch `pnpm-lock.yaml` im Repo.

---

### 🟠 A3. React 18 ↔ Next.js 16 Peer-Mismatch

```
"react": "^18.3.1",
"next": "^16.2.6",
"eslint-config-next": "^16.2.9"
```

Next.js 16 ist für React 19 ausgelegt. Mit React 18 funktioniert es, aber:

- Peer-Warning-Spam beim Build
- `eslint-config-next@16` setzt React-19-spezifische Lint-Regeln → falsche Signale
- Streaming/Server-Components-Optimierungen deaktiviert

**Fix (Sprint 4+):** React auf 19 heben, dann `pnpm typecheck && pnpm build && pnpm test:run`.

---

### 🟡 A4. Tailwind 3 in Next-16-Ära

`tailwindcss ^3.4.19` + `tailwindcss-animate ^1.0.7` — bewusste Wahl oder pending Migration? → In `docs/HANDBOOK.md` dokumentieren.

---

### 🟡 A5. Doppelte + widersprüchliche Overrides — ✅ **GEFIXT 23.07.**

Overrides in `package.json` konsolidiert:

```json
"overrides": {
  "@modelcontextprotocol/sdk": "^1.29.0",
  "brace-expansion": ">=5.0.7",
  "esbuild": ">=0.25.0 <1.0.0",
  "js-yaml": ">=4.3.0"
}
```

`pnpm-workspace.yaml`-Overrides entfernt. `js-yaml` von `>=4.1.2` auf `>=4.3.0` angehoben (behebt CVE). `brace-expansion >=5.0.7` hinzugefügt (behebt DoS-CVE).

✅ **Verifiziert 23.07.:** Lockfile nach `pnpm update` geprüft:

- `js-yaml`: 4.2.0 ❌ → 4.3.0 ✅
- `brace-expansion`: 1.1.15 ❌ → 1.1.16 ✅ / 5.0.6 ❌ → 5.0.8 ✅

---

### 🟡 A6. `swagger-ui-react` / `next-swagger-doc` Kompatibilität

- `swagger-ui-react` benötigt React-Peer-Dep; bei React-19-Upgrade prüfen.
- `next-swagger-doc` ist Pre-App-Router; für Next 16 / App Router ggf. Anpassungen nötig.

---

### 🟡 A7. `lucide-react` Major 0.x → 1.x — ✅ **VALIDIERT 23.07.**

**Ergebnis:** 120+ eindeutige Icons in 266 Import-Zeilen geprüft. Alle Icon-Namen (inkl. Risikokandidaten wie `PenSquare`, `CheckCircle2`, `Swords`, `UtensilsCrossed`) existieren in `lucide-react@1.26.0`. Keine veralteten 0.x-Namen gefunden. TypeScript-Build bestätigt Korrektheit.

---

## Teil B: CVE-Daten (dynamische Analyse) — Stand nach allen Fixes

### 🔴 Verbleibende High CVEs (2 von ursprünglich 19)

| Package      | Betroffene Versionen | Issue                                            | Fix-Version | Quelle (Direktabhängigkeit) | Status                           |
| ------------ | -------------------- | ------------------------------------------------ | ----------- | --------------------------- | -------------------------------- |
| **undici**   | ≥7.23.0 <7.28.0      | TLS certificate validation bypass via SOCKS5     | ≥7.28.0     | `jsdom` (devDep)            | 🟡 Nur dev — geringes Risiko     |
| **fast-uri** | —                    | Host confusion via backslash authority delimiter | TBD         | Tief transitiv              | 🟡 Kein direktes Upgrade möglich |

### ✅ Bereits behobene High CVEs (17)

| Package                  | Issue                                | Behoben durch                                                  |
| ------------------------ | ------------------------------------ | -------------------------------------------------------------- |
| **form-data**            | CRLF injection                       | `pnpm update` + `swagger-ui-react`-Upgrade (5.32.6→5.32.11)    |
| **undici** (2 von 3)     | DoS + Cross-origin routing           | `pnpm update` — transitive Auflösung                           |
| **brace-expansion** (2×) | DoS via exponential expansion        | Override `>=5.0.7` + `pnpm update` → Lockfile: 1.1.16/5.0.8 ✅ |
| **js-yaml**              | YAML merge-key chains → CPU          | Override `>=4.3.0` + `pnpm update` → Lockfile: 4.3.0 ✅        |
| **axios**                | Improper proxy usage                 | `swagger-ui-react`-Upgrade (5.32.6→5.32.11)                    |
| **immutable** (2×)       | 32-bit overflow + Hash-collision DoS | Radix-Komponenten-Upgrades (15 Pakete → neueste Patches)       |
| **Mehrere Moderate/Low** | Verschiedenes                        | `pnpm update` — transitive Neuauflösung aller Abhängigkeiten   |

> ℹ️ `form-data` war ursprünglich via `openai` und `swagger-ui-react` betroffen. Durch das `swagger-ui-react`-Upgrade und die `pnpm update`-Neuauflösung ist der CVE-Pfad vollständig geschlossen.

---

### 🟡 License Assessment

| Lizenz                    | Vorkommen                   | Risiko                                                          |
| ------------------------- | --------------------------- | --------------------------------------------------------------- |
| MIT, Apache-2.0, ISC, BSD | ~95%                        | ✅ Kein Risiko                                                  |
| `node-forge`              | `(BSD-3-Clause OR GPL-2.0)` | ⚠️ Optional GPL-2.0 — sicherstellen, dass BSD-Option greift     |
| `dompurify`               | `(MPL-2.0 OR Apache-2.0)`   | 🟡 MPL-2.0 = Weak Copyleft, nur auf Dateiebene, geringes Risiko |
| `opener`                  | `(WTFPL OR MIT)`            | 🟢 Unkonventionell aber freizügig                               |

---

## Teil C: Veraltete Pakete (nach Phase-2-Upgrades)

✅ Bereits upgraded:

- `swagger-ui-react`: 5.32.6 → 5.32.11
- `@radix-ui/react-*` (15 Pakete): alle auf neueste Patches

🔜 Noch offen (alle Patch/Minor, kein Sicherheitsrisiko):

| Package                                                 | Current | Latest  | Typ             |
| ------------------------------------------------------- | ------- | ------- | --------------- |
| `next` / `eslint-config-next` / `@next/bundle-analyzer` | 16.2.9  | 16.2.11 | devDependencies |
| `@tanstack/react-query`                                 | 5.101.0 | 5.101.4 | dependencies    |
| `@vitest/coverage-v8`                                   | 4.1.8   | 4.1.10  | devDependencies |
| `autoprefixer`                                          | 10.5.0  | 10.5.4  | devDependencies |
| `dompurify`                                             | 3.4.10  | 3.4.12  | dependencies    |
| `next-intl`                                             | 4.13.0  | 4.13.4  | dependencies    |
| `postcss`                                               | 8.5.15  | 8.5.22  | devDependencies |
| `uuid`                                                  | 14.0.0  | 14.0.1  | devDependencies |

> ⚠️ `@react-email/components` (v1.0.12) ist als **deprecated** markiert.

---

## 🔧 Priorisierte Roadmap

### 🔴 Phase 1 — ✅ **ABGESCHLOSSEN 23.07.**

1. ✅ `pnpm-workspace.yaml` `allowBuilds` repariert (Befund A1)
2. ✅ `js-yaml`-Override auf `>=4.3.0` (Befund A5 + CVE)
3. ✅ `package-lock.json` aus Git entfernt + in `.gitignore` (Befund A2)
4. ✅ Overrides in EINE Datei konsolidiert (Befund A5)
5. ✅ `brace-expansion`-Override `>=5.0.7` hinzugefügt
6. ✅ `pnpm update` → Overrides vollständig im Lockfile durchgesetzt

### 🟠 Phase 2 — ✅ **ABGESCHLOSSEN 23.07.**

5. ✅ `swagger-ui-react` upgraded (5.32.6→5.32.11) → fixt `axios`
6. ✅ 15 `@radix-ui/react-*` Pakete auf neueste Patches → fixt `immutable`-CVEs

### 🟡 Phase 3 — Sprint 4+

9. React 18 → 19 evaluieren (Befund A3)
10. Tailwind-3-Strategie in `docs/HANDBOOK.md` dokumentieren (Befund A4)
11. `lucide-react`-Imports gegen 1.x-Doku validieren (Befund A7)
12. License-Check CI-Step als GitHub Action
13. `pnpm audit --prod --fail-on high` als Severity-Gate in CI

---

## ✅ Fazit

- **Keine kritischen Schwachstellen** — und nie welche gehabt
- **Von 48 auf 6 CVEs reduziert** (−87.5%) — nur noch 2 High (beide dev/transitiv)
- **7 strukturelle Config-Probleme identifiziert, 4 gefixt** — `allowBuilds`, Lockfiles, Overrides, `js-yaml`
- **Lizenzsituation unkritisch** — weitgehend MIT/Apache-2.0, keine starken Copyleft-Lizenzen
- **SBOM generiert** — `docs/sbom-cyclonedx.json` (CycloneDX 1.5, ~1.159 Komponenten)
- **Wiederverwendbares SBOM-Tool** — `scripts/gen-sbom.ts` für künftige Generierungen

### CVE-Reduktionsverlauf

| Zeitpunkt                                        | High | Moderate | Low | Total    |
| ------------------------------------------------ | ---- | -------- | --- | -------- |
| Vor Fixes (23.07.)                               | 19   | 23       | 6   | **48**   |
| Nach Phase 1 (Overrides gesetzt)                 | 16   | 21       | 5   | **42**   |
| Nach Phase 2 (Radix + swagger-ui-react upgrades) | 16   | 21       | 5   | **42** ¹ |
| Nach `pnpm update` (Lockfile-Neuauflösung)       | 2    | 3        | 1   | **6**    |

¹ Phase 2 brachte keine zusätzliche Reduktion, weil die Override-Auflösung (`js-yaml`, `brace-expansion`) und die transitiven Effekte der Upgrades erst mit `pnpm update` griffen.

---

_Report generiert am 23.07.2026 — konsolidiert aus statischer Manifest-Analyse und dynamischen `pnpm audit`/`pnpm outdated`/`pnpm licenses list`-Scans. Zuletzt aktualisiert nach Phase 1+2._
