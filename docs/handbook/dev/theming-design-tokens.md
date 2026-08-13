# Theming & Design-Tokens

> Wie das Branding pro Club funktioniert. Quelle: `tailwind.config.ts`, `design-tokens.json`, `components/ui/`.

## 🎨 Zwei-Schicht-System

```
1. SwingZ-eigenes Brand-System (fest)
   tailwind.config.ts → tokens.css → globals.css
   Dark/Light Mode beide im Standard-Style

2. Per-Club Branding (togglebar)
   clubs.branding JSONB → club_id → CSS custom properties
   Brand-Color, Secondary, Logo, …
```

## 🎨 SwingZ-Token

Schlüssel-Token (aus `tailwind.config.ts`):

| Token     | Hex (Light) | Hex (Dark) | Verwendung                            |
| --------- | ----------- | ---------- | ------------------------------------- |
| `brand`   | `#3B82F6`   | `#60A5FA`  | Primary Buttons, Links, Active States |
| `accent`  | `#10B981`   | `#34D399`  | Erfolgs-States, Headlines-Accent      |
| `warning` | `#F59E0B`   | `#FBBF24`  | Attention needed, fehlende Pflicht    |
| `danger`  | `#EF4444`   | `#F87171`  | Errors, Storno                        |
| `success` | `#10B981`   | `#34D399`  | Erfolgsmeldungen                      |

Per-Club-Override (in `club_branding`):

- `primary_color` → überschreibt `--brand`
- `secondary_color` → überschreibt `--accent`
- `logo_url` → Header-Logo

## 🌗 Dark Mode

`dark`-Class-Strategie. `html.dark` triggert alle `dark:`-Varianten in Tailwind.

Setup in `app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --brand: 217 91% 60%;
  /* ... */
}

.dark {
  --background: 222 47% 4%;
  --foreground: 0 0% 98%;
  --brand: 217 91% 67%;
  /* ... */
}
```

`ThemeProvider` in `components/theme-provider.tsx`. Toggle in `components/theme-toggle.tsx` (Sun/Moon-Icon).

## 🧱 shadcn/ui — Base Components

**Regel:** Niemals eigene UI-Primitive bauen, die shadcn duplizieren würden. `CLAUDE.md` (DO NOT §):

> ❌ Eigene UI-Komponenten bauen die shadcn/ui duplizieren

Verwendete shadcn-Pakete: `@/components/ui/*` (Standard-Set: `button`, `card`, `dialog`, `dropdown-menu`, `input`, `popover`, `select`, `tabs`, `toast`, `tooltip`, `badge`, `avatar`, `skeleton`, `alert`, `sheet`, `separator`, `table`, `textarea`, `checkbox`, `radio-group`, `slider`, `command`, `calendar`, `sonner`).

Alle erweitert mit `cn()`-Helper aus `lib/utils`.

## 🖼 Iconographie

- **lucide-react** für Standard-Icons (alle Tree-shakable)
- **Calendar-Icon** für Session/Listendarstellung
- **Tennisplatz-SVG** als statisches Asset in `public/icons/`

## 🧩 Custom-Style-Patterns

Weit verbreitete Custom-Composition:

| Pattern              | Beispieldatei                      | Verwendung                               |
| -------------------- | ---------------------------------- | ---------------------------------------- |
| `IconBox`            | `components/ui/icon-box.tsx`       | Lucide-Icon in standardisiertem Behälter |
| `StatCard`           | `components/ui/card-features.tsx`  | KPI-Dashboard-Karten                     |
| `EmptyState`         | `components/ui/empty-state.tsx`    | Listen-leer-Zustände                     |
| `DataTable` (eigene) | `components/ui/data-table.tsx`     | Tabellen mit Sort + Pagination           |
| `Section`-Card       | `components/ui/card.tsx`           | shadcn `Card` als Basis                  |
| `ConfirmDialog`      | `components/ui/confirm-dialog.tsx` | Bestätigungsflows                        |
| `Badge`              | `components/ui/badge.tsx`          | Status-Pills (active/draft/error)        |

## 🏷 Light/Dark Mode Test

Vor jedem PR: mit beiden Themes visuell und im Snapshot testen.

- Light: Standard-Browser ohne OS-Theme-Override
- Dark: Toggle aktiv + Reload

## 📅 Calendar/Icons

Tennis-Spezifisch:

- **Platz-Icon**: Lucide `MapPin` (Standard) oder Custom-SVG
- **Trainer-Icon**: Lucide `GraduationCap`
- **Schläger-Icon**: Custom in `public/icons/racket.svg`

## 🧪 Visuelle Tests

- **Playwright-Snapshots**: `tests/browser/design-preview-*.test.ts` (mehrere Dateien)
- **Storybook** (optional, nicht aktiv): Komponenten-Isolierung

## 📚 Verwandte Kapitel

- [`dev/testing-strategy.md`](./testing-strategy.md) — Visuelle-Regression
- [`user/admin.md`](../user/admin.md) — Admin-UI-Beispiele
- [`data-model.md`](./data-model.md) — `club_branding` Spalten
