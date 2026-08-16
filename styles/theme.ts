// SWINGZ Design Tokens — reiner Tailwind-Config-Zulieferer.
// EINZIGE Laufzeit-Token-Quelle ist app/globals.css (CSS-Variablen, Light/Dark).
// Diese Datei liefert nur statische Skalen an tailwind.config.ts — sie wird
// nirgendwo sonst importiert. Neue Farben hier NICHT ergänzen; erst prüfen,
// ob ein semantisches Token (success/warning/error/info, brand-*) passt.

export const colors = {
  // Accent – Court Green (aus Club-Logo abgeleitet) — als brand-accent-Skala in Tailwind
  accent: {
    50: '#f5f9e8',
    100: '#e7f2c9',
    200: '#d3e696',
    300: '#bcd662',
    400: '#a6cb3d',
    500: '#94c121',
    600: '#749419',
    700: '#5c7515',
    800: '#465913',
    900: '#3a4a12',
    950: '#212b08',
    brand: '#94C121',
    ember: '#749419',
  },
  // Neutrals – Refined Warm Grays with Depth
  gray: {
    25: '#fefefe',
    50: '#fafafa',
    100: '#f5f5f6',
    150: '#ebebec',
    200: '#e0e1e3',
    300: '#c7c9cc',
    400: '#a0a3a8',
    500: '#75787f',
    600: '#54585f',
    700: '#3a3f47',
    800: '#252a33',
    900: '#151921',
    950: '#0c0f14',
  },
  // Semantic — shade scales match Tailwind's green/red/amber/blue defaults
  // so `success-500` etc. render identically to the raw classes they replace.
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    DEFAULT: '#22c55e',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    DEFAULT: '#f59e0b',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    DEFAULT: '#ef4444',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    DEFAULT: '#3b82f6',
  },
};

export const typography = {
  fontFamily: {
    sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
    // ponytail: "Clash Display" wurde nirgends geladen — kein @font-face, kein
    // next/font, kein CDN-Link. Die 35 `font-display`-Stellen sind damit seit
    // jeher auf DM Sans zurückgefallen, nur unbemerkt: ein Font-Stack, dessen
    // erster Eintrag nicht existiert, sagt nichts, er verschweigt nur. Der
    // Entwurf führt ohnehin durchgehend DM Sans. Wenn Clash Display wirklich
    // kommen soll, gehört es zuerst in app/fonts/ und app/layout.tsx.
    display: ['"DM Sans"', 'system-ui', 'sans-serif'],
    mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
  },
  fontSize: {
    // Kleinste Stufe. Nur für dichte Raster (Kalenderzellen, Heatmap-Achsen),
    // nicht für Fliesstext. Ersetzt die frühere Arbitrary-Schreibweise
    // `text-[9px]` — und die zwei `text-[8px]`, die darunter lagen.
    '3xs': '0.5625rem',
    '2xs': '0.625rem',
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
    '7xl': '4.5rem',
    '8xl': '6rem',
    '9xl': '8rem',
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  lineHeight: {
    none: 1,
    tight: 1.15,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 1.75,
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

export const radius = {
  none: '0',
  /** Single Source of Truth for the dashboard design system (10 px).
   *  Root-font-independent literal; `xl` below ist der operative
   *  Tailwind-Key (rounded-xl). Nur für Inline-Styles (E-Mail, SVG),
   *  wo eine CSS-Variable nicht erreichbar ist. */
  base: '10px',
  // Kanonische 3er-Skala: md (Inputs/Buttons), xl (Cards, = base SSOT), full.
  // sm/lg/2xl/3xl bleiben definiert (dynamische Klassen), sind aber im Code migriert
  // und werden vom Guardrail (scripts/check-design-tokens.sh) blockiert.
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '10px',
  '2xl': '1.5rem',
  '3xl': '2rem',
  '4xl': '3rem',
  full: '9999px',
};

export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
  lg: '0 12px 24px -4px rgb(0 0 0 / 0.1), 0 4px 8px -2px rgb(0 0 0 / 0.06)',
  xl: '0 24px 48px -8px rgb(0 0 0 / 0.12), 0 8px 16px -4px rgb(0 0 0 / 0.08)',
  '2xl': '0 32px 64px -12px rgb(0 0 0 / 0.2)',
  '3xl': '0 48px 80px -16px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  glow: {
    primary: '0 0 60px -12px hsl(206 100% 31% / 0.4), 0 0 24px -8px hsl(206 100% 31% / 0.3)',
    primaryStrong: '0 0 80px -16px hsl(206 100% 31% / 0.5), 0 0 40px -12px hsl(206 100% 31% / 0.4)',
    accent: '0 0 60px -12px hsl(77 71% 44% / 0.4), 0 0 24px -8px hsl(77 71% 44% / 0.3)',
    accentStrong: '0 0 80px -16px hsl(77 71% 44% / 0.5), 0 0 40px -12px hsl(77 71% 44% / 0.4)',
    premium:
      '0 24px 64px -16px rgba(0, 0, 0, 0.15), 0 8px 32px -8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
  },
  card: {
    default: '0 2px 8px -2px rgb(0 0 0 / 0.06), 0 4px 16px -4px rgb(0 0 0 / 0.04)',
    hover: '0 12px 32px -8px rgb(0 0 0 / 0.1), 0 4px 12px -4px rgb(0 0 0 / 0.06)',
    elevated:
      '0 24px 48px -12px rgb(0 0 0 / 0.12), 0 8px 24px -8px rgb(0 0 0 / 0.08), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
  },
  button: {
    default: '0 2px 8px -2px hsl(206 100% 31% / 0.3), 0 1px 2px rgba(0, 0, 0, 0.05)',
    hover: '0 8px 24px -4px hsl(206 100% 31% / 0.4), 0 2px 8px -2px hsl(206 100% 31% / 0.2)',
    active: '0 1px 4px hsl(206 100% 31% / 0.3) inset',
  },
};

export const gradients = {
  // Nur `hero` wird noch verdrahtet (tailwind.config.ts → bg-gradient-hero).
  // Die übrigen Verläufe (primary/accent/mesh/aurora/glass/text …) waren
  // Reste der alten blauen Marke (hsl 206) und wurden am 16.08.2026 entfernt —
  // sie standen in keiner Utility mehr und widersprachen der Grün/Gold-Palette.
  hero: 'linear-gradient(160deg, hsl(206 100% 18%) 0%, hsl(206 100% 31%) 40%, hsl(204 85% 45%) 100%)',
};
