# Prompt: Design-Vereinheitlichung SwingZ

> Diesen Prompt in einer frischen Session an Claude geben. Er enthält die gemessene Ist-Analyse (Stand 2026-07-15) und ist selbsterklärend.

---

Du bist Design-System-Engineer für **SwingZ**, ein Tennis-Club-Management-SaaS (Next.js 16, Tailwind, shadcn/ui, deutsche UI). Deine Aufgabe: das visuelle Chaos auf **ein einziges, professionelles Design-System** konsolidieren — **ohne Redesign**. Die freigegebene Design-Richtung existiert bereits (warmes Off-White `hsl(35 25% 97%)`, Forest-Green-Primary `hsl(150 48% 18%)`, Clay-Akzent, `--radius: 10px`); sie steht in `app/globals.css` und `docs/DESIGN_KONZEPT.md` und wird nicht neu erfunden.

## Gemessener Ist-Zustand (kurz verifizieren, dann fixen)

1. **719 hartcodierte Tailwind-Farbklassen** (`bg-purple-900`, `text-yellow-100`, `bg-indigo-50` …) in 49 Dateien unter `app/` und `components/` — Farben, die in der Brand-Palette gar nicht existieren.
2. **Zwei konkurrierende Token-Quellen:** `app/globals.css` (HSL, aktiv) und `styles/theme.ts` (Hex, von 0 Dateien direkt importiert).
3. **7 Corner-Radius-Varianten** parallel im Einsatz (`rounded-sm` bis `rounded-3xl`), obwohl `--radius: 10px` als Single Source of Truth deklariert ist.
4. **31 verschiedene `<h1>`-Klassenkombinationen**; `PageHeader` (`components/ui/page-header.tsx`) wird nur auf 29 von 126 Pages verwendet. Heading-Größen streuen (119× `text-2xl font-bold`, 31× `text-3xl`, 5× `text-4xl`).
5. **`StatusBadge` nur in 12 Dateien** — überall sonst handgebaute Farbchips.
6. **80 Gradient-Verwendungen und 70 Inline-Styles** verstreut über die App.
7. `docs/DESIGN.md` und `docs/DESIGN2.md` sind byte-identische Duplikate.

## Arbeitspakete (in dieser Reihenfolge, 1 Commit pro Paket)

**AP1 — Token-Konsolidierung:**
Prüfe, ob `tailwind.config` `styles/theme.ts` referenziert. Falls ja: reduziere `theme.ts` auf reinen Config-Zulieferer, der die CSS-Variablen spiegelt; falls nein: lösche die Datei. Definiere in `tailwind.config` semantische Aliase für 5 Status-Farben (`success`, `warning`, `error`, `info`, `neutral`), gemappt auf CSS-Variablen mit Light/Dark-Werten in `globals.css`. Danach gibt es genau EINE Token-Quelle: `globals.css`. Lösche `docs/DESIGN2.md` (Duplikat).

**AP2 — Farb-Migration (der größte Hebel):**
Ersetze alle ~719 hartcodierten Farbklassen. Mapping-Regel: purple/indigo/violet → `primary`- oder `info`-Token, yellow/amber → `warning`, emerald/green → `success`, red → `destructive`, orange → `accent`, gray/slate/zinc → `muted`/`border`/`foreground`. Wo eine Farbe einen Status codiert (aktiv, offen, bezahlt, storniert …), verwende `StatusBadge` statt handgebauter Chips. Jede Ersetzung muss in Light UND Dark Mode funktionieren. Arbeite in Batches pro Rollen-Bereich (admin → trainer → member → owner → superadmin → public), jeweils mit Zwischencommit.

**AP3 — Komponenten-Durchsetzung:**

- Alle Pages mit sichtbarem Titel nutzen `PageHeader` (Titel + Beschreibung + Aktionen). Genau eine Heading-Skala: h1 = `text-2xl font-bold tracking-tight`, h2 = `text-lg font-semibold` — definiert in `PageHeader` bzw. einer `SectionHeader`, nicht pro Page.
- Radius-Skala auf 3 Werte: `rounded-md` (Inputs/Buttons), `rounded-xl` (Cards), `rounded-full` (Avatare/Pills). `rounded-sm/lg/2xl/3xl` migrieren.
- Gradients nur an maximal 2 definierten Stellen (Landing-Hero, Featured-KPI-Karte). Restliche ~80 Vorkommen → flache Token-Flächen.
- Inline-Styles eliminieren, außer sie transportieren dynamische Laufzeitwerte (Chart-Höhen, Fortschrittsbalken-Breiten).

**AP4 — Guardrail:**
Lege `scripts/check-design-tokens.sh` an (CI-tauglich), das bei neuen hartcodierten Farbklassen failt:
`grep -rE '(bg|text|border)-(purple|indigo|violet|yellow|emerald|lime|teal|cyan|sky|blue|rose|pink|fuchsia)-[0-9]+' app components --include='*.tsx'` → Exit 1 bei Treffern.

## Regeln

- **Kein Redesign.** Layouts, Abstände, Informationsarchitektur bleiben. Nur Vereinheitlichung auf bestehende Tokens/Komponenten.
- shadcn/ui aus `@/components/ui/` verwenden, niemals duplizieren. `cn()` aus `@/lib/utils`.
- Jede Änderung in beiden Themes prüfen (Light + Dark).
- Deutsche UI-Texte unangetastet lassen.
- Nach jedem Arbeitspaket: `npx tsc --noEmit` → 0 Errors, dann Commit.

## Definition of Done

- Guardrail-Grep (AP4) → 0 Treffer.
- Genau eine Token-Quelle (`globals.css`); `styles/theme.ts` gelöscht oder reiner Config-Zulieferer.
- Alle Pages mit sichtbarem Titel nutzen `PageHeader`; eine einheitliche Heading-Skala.
- Radius-Grep zeigt nur noch `rounded-md|rounded-xl|rounded-full`.
- `scripts/check-design-tokens.sh` läuft und failt bei Verstößen.
- `npx tsc --noEmit` → 0 Errors; Screenshots von 3 Kern-Pages (Admin-Dashboard, Buchungen, Member-Profil) in beiden Themes als Beleg.
