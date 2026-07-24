# Spike: Tailwind 3 → 4 Migration

> **Sprint:** 4+ | **Aufwand:** 3–5 Tage (inklu. Testing) | **Prio:** Niedrig  
> **Quelle:** [AUDIT-DEPS-2026-07-23.md](./AUDIT-DEPS-2026-07-23.md) — Befund A4  
> **Status:** 🟡 Backlog

---

## Ausgangslage

Aktuell läuft das Projekt auf **Tailwind CSS 3.4.19** mit `tailwindcss-animate ^1.0.7`.  
Next.js 16 ist auf Tailwind 4 ausgelegt — die Migration ist kein Sicherheitsrisiko,  
aber für Performance (CSS-First, kein JS-Config-Parsing mehr) und Zugang zu  
Container Queries, `color-mix()`, vereinfachter Arbitrary-Value-Syntax sinnvoll.

### Migration Scope

| Bereich                                     | Aufwand | Risiko                                                             |
| ------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `tailwind.config.ts` → `@theme` in CSS      | Mittel  | Theme-Werte 1:1 migrieren, Typen prüfen                            |
| `postcss.config.mjs`                        | Gering  | `@tailwindcss/postcss` statt `tailwindcss`                         |
| `globals.css` Direktiven                    | Gering  | `@tailwind` → `@import "tailwindcss"`                              |
| `tailwindcss-animate`                       | Gering  | In Tailwind 4 nativ enthalten oder Drop-in                         |
| `@apply`-Nutzung (1 Datei)                  | Gering  | Nur `app/globals.css` betroffen                                    |
| Custom Keyframes (`aurora`, `slide-down`)   | Gering  | Syntax-Update in `@theme`-Block                                    |
| `safelist` / `blocklist`                    | Gering  | Tailwind 4 hat keine safelist — Klassen via `@utility` oder inline |
| Dark Mode (`class`-Strategie)               | Gering  | Tailwind 4 unterstützt `class`-Strategie nativ                     |
| Komponenten (`app/`, `components/`, `lib/`) | Kein    | Tailwind-Utility-Klassen bleiben identisch ✅                      |

---

## Konkrete Migrationsschritte

### 1. Abhängigkeiten aktualisieren

```bash
pnpm add -D tailwindcss@^4 @tailwindcss/postcss
pnpm remove tailwindcss-animate          # in Tailwind 4 nativ
pnpm remove autoprefixer                 # in Tailwind 4 nativ
```

### 2. `postcss.config.mjs` umstellen

```js
// Vorher
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

// Nachher
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

### 3. `tailwind.config.ts` → `app/globals.css`

Der gesamte Theme-Block wandert als CSS-First `@theme`-Direktive in die CSS-Datei.  
Beispiel für die wichtigsten Custom-Werte:

```css
@import 'tailwindcss';

@theme {
  /* Colors — aus tailwind.config.ts > theme.extend.colors */
  --color-brand-50: #fff7ed;
  --color-brand-100: #ffedd5;
  /* ... alle Brand-Farben ... */
  --color-brand-900: #7c2d12;

  /* Fonts */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Cal Sans', 'Inter', sans-serif;

  /* Font Sizes */
  --text-hero: 3.5rem;
  --text-hero--line-height: 1.1;
  --text-display: 2.5rem;

  /* Animations — aus tailwind.config.ts > theme.extend.keyframes + animation */
  --animate-aurora: aurora 15s linear infinite;
  --animate-slide-down: slide-down 0.3s ease-out;

  @keyframes aurora {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  @keyframes slide-down {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
}
```

### 4. `@tailwind`-Direktiven ersetzen

```css
/* Vorher */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Nachher */
@import 'tailwindcss';
```

### 5. Dark Mode

Tailwind 4 unterstützt `class`-Strategie via `@variant` oder Media-Query.  
Da das Projekt `darkMode: 'class'` nutzt, bleibt `dark:`-Präfix erhalten.

### 6. Safelist / Blocklist auflösen

- `blocklist: [-:T.Z]` → entfällt (Tailwind 4 hat keine blocklist)
- `safelist: bg-gradient-*`, `rounded-bubble`, `animate-shimmer` → diese Klassen müssen entweder im Code verwendet oder als `@utility` definiert werden

### 7. `tailwindcss-animate` ersetzen

Tailwind 4 hat `animate-*` nativ. Die vorhandenen Animations-Klassen (`animate-aurora`, `animate-slide-down`) sind bereits als Custom-Keyframes definiert und müssen nur in den `@theme`-Block übernommen werden.

---

## Validierung

```bash
pnpm dev           # Dev-Server starten, visuell prüfen
pnpm typecheck     # TypeScript
pnpm build         # Production-Build
pnpm test:run      # Unit-Tests
```

Manuelle Sichtprüfung:

- Admin-Dashboard (Dark Mode!)
- Member-Pages
- Landing Page
- Forms, Buttons, Cards, Modals
- Responsive Breakpoints (Mobile → Desktop)

---

## Risiken & Fallbacks

| Risiko                                     | Mitigation                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Theme-Farben nicht 1:1 migrierbar          | CSS-Variablen-Vergleich mit Chrome DevTools vor/nach Migration                   |
| `safelist`-Klassen werden nicht generiert  | Im Code suchen, wo diese dynamisch gesetzt werden, und als `@utility` definieren |
| `tailwind-merge` + `clsx` Inkompatibilität | `tailwind-merge` unterstützt Tailwind 4 — Version prüfen                         |
| shadcn/ui-Komponenten                      | shadcn/ui hat Tailwind-4-Support seit 2025 — ggf. `npx shadcn@latest init` rerun |

---

## Referenzen

- [Tailwind CSS v4 Migration Guide](https://tailwindcss.com/docs/upgrade-guide)
- [@tailwindcss/postcss](https://tailwindcss.com/docs/installation/using-postcss)
- [AUDIT-DEPS-2026-07-23.md](./AUDIT-DEPS-2026-07-23.md) — Befund A4
