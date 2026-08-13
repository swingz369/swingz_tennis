# Theming & Design-Tokens

> Zuletzt verifiziert: 13.08.2026

> Wie das Branding pro Club funktioniert und wo die Farben herkommen.

## 🎨 Token-Quellen (Single Source of Truth)

Es gibt **eine** Laufzeit-Quelle und **eine** statische Zuliefer-Quelle:

```
1. app/globals.css          ← EINZIGE Laufzeit-Token-Quelle
   CSS-Variablen (--background, --brand-*, --success, …) in Light + Dark.
   `:root` und `.dark` definieren beide Modi.

2. styles/theme.ts          ← statischer Zulieferer für tailwind.config.ts
   Skalen (colors.gray/success/warning/error/info/accent), typography,
   shadows (inkl. glow-primary/accent), gradients, radius.
   Wird nirgendwo sonst importiert — hier KEINE neuen Farben ergänzen,
   ohne zu prüfen ob ein semantisches Token passt.

3. tailwind.config.ts       ← Verdrahtung
   mappt CSS-Variablen (hsl(var(--…))) und theme.ts-Skalen zu Utilities.
```

`design-tokens.json` im Repo-Root ist eine **Referenz/Inventur-Datei**, keine
Laufzeit-Quelle — sie kann veralten; maßgeblich sind `globals.css` + `theme.ts`.

## 🎨 Brand-Tokens (Blau/Grün)

Light-Modus (`:root` in `app/globals.css`):

| Token                      | HSL (Light)    | Hex       | Verwendung                            |
| -------------------------- | -------------- | --------- | ------------------------------------- |
| `--brand-primary`          | `206 100% 31%` | `#00599F` | Primär (Blau) — Buttons, Links, Aktiv |
| `--brand-primary-light`    | `201 68% 59%`  | —         | Helles Blau — Gradient-Endpunkt, Glow |
| `--brand-dark`             | —              | —         | Dunkles Blau — Hero-Hintergründe      |
| `--brand-secondary`        | `217 40% 22%`  | `#22334F` | Navy — Tiefe, Flächen                 |
| `--brand-accent`           | `77 71% 44%`   | `#94C121` | Court Green — CTAs, Akzente           |
| `--brand-accent-dashboard` | `77 71% 44%`   | `#94C121` | Dashboard-Akzent                      |

Dark-Modus (`.dark`):

| Token                      | HSL (Dark)    |
| -------------------------- | ------------- |
| `--brand-primary`          | `201 68% 59%` |
| `--brand-primary-light`    | `201 68% 70%` |
| `--brand-secondary`        | `217 40% 35%` |
| `--brand-accent`           | `77 71% 50%`  |
| `--brand-accent-dashboard` | `77 71% 50%`  |

> **Default-Palette ist Blau/Grün.** Es gibt kein Grün/Orange- oder
> Blau/Grün-„#3B82F6/#10B981"-Paralleluniversum mehr. Die frühere
> Forest-Green/Orange-Palette (`#1B4332`/`#FF6B35`) ist abgelöst.

### Semantische Tokens

shadcn-Basis (`--background`, `--foreground`, `--card`, `--popover`,
`--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`,
`--border`, `--input`, `--ring`) kommen aus `globals.css`. Die
Status-Skalen `success`/`warning`/`error`/`info` kommen als statische
Skalen aus `styles/theme.ts` (sie entsprechen Tailwinds Default-Skalen).

## 🎨 Per-Club-Branding

Branding liegt als **Spalten auf `clubs`**, nicht als JSONB:

- `primary_color` → überschreibt `--brand-primary`
- `secondary_color` → überschreibt `--brand-secondary`
- `accent_color` → überschreibt `--brand-accent`
- (Logos/Favicon/Domain getrennt, s. `lib/branding.ts` + `app/api/branding`)

Ablauf:

1. `lib/branding.ts` — `ClubBrandingSchema` (Zod) validiert den Schreibpfad;
   `DEFAULT_BRANDING` = `#00599F` / `#22334F` / `#94C121`.
2. `brandingToCSSVars()` validiert beim **Konsum** erneut (`isHexColor`,
   `HEX_COLOR_REGEX`) und fällt bei Alt-/Korrupt-Daten auf den Default zurück.
3. `app/layout.tsx` injiziert die drei `--brand-*`-Variablen zur Laufzeit —
   nur wenn der Verein eigene Farben hat; sonst greifen die `:root`-Tokens.

Die DB-Column-Defaults stellt `supabase/migrations/20260813100000_…` auf
Blau/Grün um (Migration anwenden, damit neue Vereine den neuen Default tragen).

## 🌗 Dark Mode

`dark`-Class-Strategie: `html.dark` triggert alle `dark:`-Varianten.
`ThemeProvider` in `components/theme-provider.tsx`, Toggle in
`components/theme-toggle.tsx`.

## 🧱 shadcn/ui — Base Components

**Regel:** Niemals eigene UI-Primitive bauen, die shadcn duplizieren würden.
Alle erweitert mit `cn()` aus `lib/utils`. Standard-Set in `components/ui/*`
(button, card, dialog, dropdown-menu, input, popover, select, tabs, sonner,
badge, avatar, skeleton, alert, sheet, separator, table, textarea, checkbox,
radio-group, slider, command, calendar).

## 🖼 Iconographie

- **lucide-react** für Standard-Icons (tree-shakable).
- Tennis-/Schläger-Assets als SVG in `public/icons/`.

## 🧩 Custom-Style-Patterns

| Pattern         | Beispieldatei                      | Verwendung                               |
| --------------- | ---------------------------------- | ---------------------------------------- |
| `IconBox`       | `components/ui/icon-box.tsx`       | Lucide-Icon in standardisiertem Behälter |
| `StatCard`      | `components/ui/stat-card.tsx`      | KPI-Dashboard-Karten                     |
| `FeatureCard`   | `components/ui/feature-card.tsx`   | Marketing-Tile                           |
| `EmptyState`    | `components/ui/empty-state.tsx`    | Listen-leer-Zustände                     |
| `PageLoading`   | `components/ui/page-loading.tsx`   | Seiten-Ladezustand                       |
| `PageError`     | `components/ui/page-error.tsx`     | Error-Boundary (reset-Prop)              |
| `Badge`         | `components/ui/badge.tsx`          | Status-Pills                             |
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | Bestätigungsflows                        |

## 🏷 Radius (eine Quelle)

`styles/theme.ts` → `radius.base` = `10px` ist die Single Source of Truth;
`radius.xl` ist der operative Tailwind-Key (`rounded-xl`). Die kanonische
Skala: `md` (Inputs/Buttons), `xl` (Cards). `sm/lg/2xl/3xl` bleiben definiert,
werden aber von `scripts/check-design-tokens.sh` blockiert. Es gibt **keine**
zweite `--radius`-Variable in `globals.css` mehr.

## 🏷 Light/Dark Mode Test

Vor jedem PR mit beiden Themes testen (visuell + Snapshot):

- Light: Standard-Browser ohne OS-Theme-Override
- Dark: Toggle aktiv + Reload

## 🧪 Visuelle Tests

- **Playwright-Snapshots**: `tests/browser/design-preview-*.test.ts`
- **Guardrail**: `scripts/check-design-tokens.sh` (Radius-Skala, Token-Nutzung)

## 📚 Verwandte Kapitel

- [`dev/testing-strategy.md`](./testing-strategy.md) — Visuelle-Regression
- [`user/admin.md`](../user/admin.md) — Admin-UI-Beispiele
- [`data-model.md`](./data-model.md) — `clubs`-Branding-Spalten
