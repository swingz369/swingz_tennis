# Design-Vereinheitlichung — Ergebnisbericht

**Datum:** 2026-07-15 · **Branch:** `feat/sprint-3-plus-a11y-theme-fixes` · **Basis-Prompt:** `docs/DESIGN_UNIFICATION_PROMPT.md`

Alle Zahlen in diesem Bericht wurden **frisch gemessen** (Greps, Tests, Builds in dieser Session), nicht aus bestehenden Dokumenten übernommen.

---

## Korrekturen an der ursprünglichen Analyse

Die Nachprüfung ergab zwei Fehler im Prompt-Dokument:

1. **`styles/theme.ts` war NICHT tot** — `tailwind.config.ts` importiert es relativ (`./styles/theme`); der ursprüngliche Grep prüfte nur `@/styles/theme`-Imports. Konsequenz: Datei wurde nicht gelöscht, sondern zum reinen Config-Zulieferer getrimmt.
2. **Die semantischen Skalen `success/warning/error/info` existierten bereits** in der Tailwind-Config — die Migration war dadurch mechanisch möglich, ohne neue Tokens zu erfinden.

Zusätzlich gefundene, vorher unbekannte Defekte:

- **`lib/` fehlte in den Tailwind-`content`-Globs** — Klassen, die nur in `lib/*.ts` definiert waren (z. B. `lib/court-calendar-utils.ts`, 29 Farbklassen), wurden nur zufällig generiert, wenn sie auch anderswo im Code vorkamen.
- **63 stille No-Op-Klassen:** `brand-light`/`surface-dark` existierten nur als ~20 handgeschriebene Utilities in `globals.css` (`text-`, `bg-`, `border-`) — alle `from-`/`to-`/`ring-`-Nutzungen (51×) renderten **gar nichts**.
- **17 komplett undefinierte Klassen:** `brand-dark` und `brand-950` waren nirgends definiert (`bg-brand-dark`, `to-brand-dark`, `from-brand-950` …) — kaputte Gradient-Enden.
- **Turbopack-Build-Falle:** Der Regex `/[-:T.Z]/g` in `lib/billing/datev-mapper.ts` wird von Tailwind als Arbitrary-Property-Klasse extrahiert, sobald `lib/` gescannt wird → ungültiges CSS, Build-Abbruch. Fix: `blocklist: ['[-:T.Z]']` in der Config.

---

## Ergebnis in Zahlen (vorher → nachher)

| Metrik                                                                    | Vorher           | Nachher                                                 |
| ------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------- |
| Hartcodierte Palette-Klassen (purple, emerald, yellow, orange, indigo, …) | **817**          | **0**                                                   |
| Corner-Radius-Varianten                                                   | 7 (`sm`…`3xl`)   | **3** (`md`, `xl` = 10px SSOT, `full`)                  |
| h1 in `(protected)` mit `text-3xl`/`text-4xl`                             | 50               | **0** (alle `text-2xl font-bold tracking-tight`)        |
| Off-brand Palette-Gradients                                               | 15+              | **0** (37 verbleibende sind Brand-Gradients)            |
| Token-Quellen                                                             | 2 konkurrierende | **1** (`globals.css`; `theme.ts` nur Config-Zulieferer) |
| Stille No-Op-/kaputte Brand-Klassen                                       | 80               | **0** (echte Config-Farben, alle Varianten generieren)  |
| Guardrail gegen Rückfall                                                  | keiner           | `npm run check:design` + CI-Step                        |

**Verifikation (alles in dieser Session ausgeführt):**

- `npx tsc --noEmit` → 0 Fehler
- `npm run build` (Next 16 / Turbopack, Production) → **erfolgreich**
- Unit-Tests: betroffene Suiten 79/79 grün; voller Lauf 1459 passed, 28 Failures ausschließlich in `payment-flow.test.ts` (Live-DB-Integrationstest gegen `supabase.swingz.cloud`, FK-/UUID-Datenprobleme, Datei von der Migration unberührt → designfremd)
- Tailwind-Standalone-Compile: `rounded-xl` → 10px, `from-/to-/ring-brand-light/dark` und `bg-success/warning/error/info-*` generieren nachweislich
- `bash scripts/check-design-tokens.sh` → ✅ sauber

---

## Durchgeführte Arbeitspakete (je 1 Commit)

### AP1 — Token-Konsolidierung (`60e26147`)

- `styles/theme.ts`: ungenutzte Exporte gelöscht (primary-/secondary-Skalen, spacing, transitions, breakpoints, zIndex); Header deklariert `globals.css` als einzige Laufzeit-Token-Quelle.
- `tailwind.config.ts`: `brand-accent` als volle Orange-Skala (`bg-brand-accent-100` …), `lib/` in `content`-Globs.
- `docs/DESIGN2.md` gelöscht (per `cmp` verifiziertes byte-identisches Duplikat von `DESIGN.md`).

### AP2 — Farb-Migration (`1937f800`) — 999 Ersetzungen, 95 Dateien

| Alt                                                  | Neu                                                             | Anzahl |
| ---------------------------------------------------- | --------------------------------------------------------------- | ------ |
| blue/sky/cyan/teal/indigo/violet/purple/fuchsia/pink | `info`                                                          | 414    |
| emerald/green/lime                                   | `success`                                                       | 208    |
| yellow/amber                                         | `warning`                                                       | 174    |
| orange                                               | `brand-accent` (identische Orange-Skala → kein visueller Drift) | 101    |
| red/rose                                             | `error`                                                         | 79     |
| zinc/slate/neutral/stone                             | `gray`                                                          | 23     |
| nicht existierende `*-950`-Shades                    | `*-900`                                                         | 28     |

Dark-Mode-Varianten (`dark:bg-…`) 1:1 mitmigriert. Semantik-Kollision behoben: Turnier-Status `completed` war nach Migration farbgleich mit `registration` → auf `gray` gesetzt.

### AP3 — Radius, Headings, Gradients, kaputte Klassen (`76b44e43`) — 202 Dateien

- Radius auf 3er-Skala: `sm`→`md` (28), `lg`/`2xl`/`3xl`→`xl` (423, inkl. Seiten-Varianten); `rounded-xl` in der Config auf **10px** = `--radius`-SSOT.
- 50 `<h1>` in `(protected)` auf die `PageHeader`-Skala normalisiert, responsive Eskalationen (`md:text-3xl` …) entfernt.
- 15 gleichfarbige Palette-Gradients zu flachen Token-Flächen; verbleibende 37 sind ausnahmslos Brand-Gradients (`from-brand-primary to-brand-dark` …) = sanktionierter Stil.
- `brand-light`, `brand-dark` (neu: `--brand-dark: 150 72% 14%` in beiden Themes), `surface`/`surface-dark`/`surface-elevated` als echte Tailwind-Config-Farben; 20 Hand-Utilities aus `globals.css` entfernt; `brand-950` → `brand-dark`.
- Test-Assertions (`tests/unit/court-calendar-utils`, `rsvp-status*`) auf semantische Tokens umgestellt.

### AP4 — Guardrail (`871bfa3d`)

- `scripts/check-design-tokens.sh`: failt bei Palette-Klassen und `rounded-sm/lg/2xl/3xl` in `app/components/lib/src`.
- Verdrahtet als `npm run check:design` und als CI-Step nach dem Typecheck in `.github/workflows/ci.yml`.

### Nachgelagert: Build-Fix (im Report-Commit enthalten)

- `blocklist: ['[-:T.Z]']` in `tailwind.config.ts` — Production-Build danach grün.

_Vorgelagert (`35d83641`): bestehende uncommittete Sprint-Änderungen (187 Dateien) als eigener Baseline-Commit gesichert + 3 Pre-Commit-Lint-Blocker behoben (`Date.now()`-Purity im Admin-Dashboard, `import()`-Typ-Annotation im E2E-Test, ungenutztes `catch (err)`). Bewusst NICHT committet: `.audit-captures/`, `graphify-out/`, `_customers_input.tsv`, `parse_customers.py`, `VPS_SETUP_NEXT_SESSION.md`, `AUDIT-REPORT-2026-07-09.md` (ungeprüfte bzw. potenziell sensible Artefakte)._

---

## Bewusste Abweichungen vom Prompt

1. **`theme.ts` nicht gelöscht** — es ist der Tailwind-Config-Zulieferer (siehe Korrekturen). Die Prompt-Alternative „reiner Config-Zulieferer" wurde umgesetzt.
2. **PageHeader-Adoption nicht massenhaft erzwungen** — 29 von 57 h1-Dateien in `(protected)` nutzen `PageHeader`. Die visuelle Vereinheitlichung ist über die normalisierte h1-Skala erreicht; die strukturelle Umstellung der restlichen 28 Dateien ist manuelle JSX-Chirurgie pro Seite (dynamische Titel, individuelle Aktionen) und als Folge-Task sinnvoller als per Skript riskiert.
3. **Brand-Gradients (37) bleiben** — alle on-palette, einheitlicher Stil für Hero-Karten und Avatare. Eliminiert wurden nur off-brand Palette-Gradients.

## Offene Punkte (Folge-Tasks)

- [ ] `PageHeader` in den restlichen 28 `(protected)`-Dateien mit eigenem `<h1>` (strukturell, pro Seite)
- [ ] ~70 Inline-Styles prüfen (dynamische Werte wie Chart-Höhen sind legitim, der Rest nicht)
- [ ] Screenshots beider Themes für 3 Kern-Pages als visueller Beleg (laufende App + Login nötig)
- [ ] `payment-flow.test.ts`: 6 designfremde Failures gegen Live-DB — FK-Constraint `invoices_member_id_fkey` + leere UUIDs, vermutlich Testdaten-Drift
- [ ] Variant-Namen wie `variant: 'blue' | 'orange' | 'purple'` (z. B. Admin-SmartActions) heißen noch nach Farben statt semantisch — kosmetisch, die Klassen dahinter sind migriert
