// SWINGZ Design Tokens – Premium Tennis Club Management
// Philosophy: Refined Elegance meets Athletic Performance
// Colors: Deep Forest + Midnight Navy + Sunrise Orange

export const colors = {
  // Primary – Forest Green (SwingZ Brand Core)
  primary: {
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
    950: '#0a3d2e',
    brand: '#1B4332',
    velvet: '#0f2d22',
  },
  // Secondary – Midnight Navy (Depth & Trust)
  secondary: {
    50: '#f0f4f8',
    100: '#d9e2ec',
    200: '#bcccdc',
    300: '#9fb3c8',
    400: '#829ab1',
    500: '#627d98',
    600: '#486581',
    700: '#3e5c76',
    800: '#334e68',
    900: '#1e3a5f',
    950: '#0f1f33',
    brand: '#1e3a5f',
    obsidian: '#0a1420',
  },
  // Accent – Sunrise Orange (Energy & Action)
  accent: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    950: '#4a1a0b',
    brand: '#FF6B35',
    ember: '#e85a2a',
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
    display: ['"Clash Display"', '"DM Sans"', 'system-ui', 'sans-serif'],
    // Marketing-only (Editorial Sports theme). Pally via Fontshare CDN — switch
    // to PP Editorial New once Pangram license is procured (~next/font/local).
    editorial: ['"Pally"', '"PP Editorial New"', 'Georgia', 'serif'],
    mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
  },
  fontSize: {
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

export const spacing = {
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
  '4xl': '6rem',
};

export const radius = {
  none: '0',
  /** Single Source of Truth for the dashboard design system (10 px).
   *  Mirrored exactly to `app/globals.css` `--radius: 10px` (literal
   *  pixel, was 0.625rem so the contract is root-font-independent and
   *  self-documenting). Use this when building new components or when
   *  the CSS variable isn't reachable (e.g. inline styles in email
   *  templates, SVG geometry). */
  base: '10px',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  '4xl': '3rem',
  full: '9999px',
  bubble: '1.5rem 1.5rem 0 1.5rem',
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
    primary: '0 0 60px -12px hsl(150 48% 18% / 0.4), 0 0 24px -8px hsl(150 48% 18% / 0.3)',
    primaryStrong: '0 0 80px -16px hsl(150 48% 18% / 0.5), 0 0 40px -12px hsl(150 48% 18% / 0.4)',
    accent: '0 0 60px -12px hsl(26 100% 60% / 0.4), 0 0 24px -8px hsl(26 100% 60% / 0.3)',
    accentStrong: '0 0 80px -16px hsl(26 100% 60% / 0.5), 0 0 40px -12px hsl(26 100% 60% / 0.4)',
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
    default: '0 2px 8px -2px hsl(150 48% 18% / 0.3), 0 1px 2px rgba(0, 0, 0, 0.05)',
    hover: '0 8px 24px -4px hsl(150 48% 18% / 0.4), 0 2px 8px -2px hsl(150 48% 18% / 0.2)',
    active: '0 1px 4px hsl(150 48% 18% / 0.3) inset',
  },
};

export const gradients = {
  primary:
    'linear-gradient(135deg, hsl(150 48% 18%) 0%, hsl(150 41% 30%) 50%, hsl(150 45% 35%) 100%)',
  primaryRadial:
    'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(150 45% 35%) 0%, hsl(150 48% 18%) 100%)',
  primaryMesh: `    radial-gradient(at 40% 20%, hsl(150 48% 25% / 0.8) 0px, transparent 50%),
    radial-gradient(at 80% 0%, hsl(150 45% 35% / 0.6) 0px, transparent 50%),
    radial-gradient(at 0% 50%, hsl(217 33% 20% / 0.5) 0px, transparent 50%),
    radial-gradient(at 80% 50%, hsl(150 48% 30% / 0.4) 0px, transparent 50%),
    radial-gradient(at 0% 100%, hsl(217 33% 25% / 0.6) 0px, transparent 50%),
    radial-gradient(at 80% 100%, hsl(150 45% 35% / 0.5) 0px, transparent 50%),
    radial-gradient(at 0% 0%, hsl(150 50% 20% / 0.7) 0px, transparent 50%)
  `,
  accent:
    'linear-gradient(135deg, hsl(26 100% 60%) 0%, hsl(26 100% 67%) 50%, hsl(26 100% 73%) 100%)',
  accentRadial: 'radial-gradient(circle at 70% 30%, hsl(26 100% 73%) 0%, hsl(26 100% 60%) 100%)',
  hero: 'linear-gradient(160deg, hsl(150 72% 14%) 0%, hsl(150 48% 18%) 40%, hsl(150 41% 30%) 100%)',
  heroMesh: `
    radial-gradient(ellipse 100% 100% at 20% 0%, hsl(150 45% 35% / 0.25) 0%, transparent 50%),
    radial-gradient(ellipse 80% 80% at 80% 20%, hsl(26 100% 60% / 0.1) 0%, transparent 40%),
    radial-gradient(ellipse 60% 60% at 40% 80%, hsl(217 33% 24% / 0.2) 0%, transparent 50%),
    linear-gradient(160deg, hsl(150 72% 14%) 0%, hsl(150 48% 18%) 40%, hsl(150 41% 30%) 100%)
  `,
  glass: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
  glassDark: 'linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 100%)',
  mesh: 'linear-gradient(135deg, hsl(150 48% 18%) 0%, hsl(150 41% 30%) 25%, hsl(150 45% 35%) 50%, hsl(150 41% 52%) 75%, hsl(150 40% 62%) 100%)',
  aurora: `
    radial-gradient(ellipse 60% 40% at 10% 20%, hsl(150 45% 35% / 0.3) 0%, transparent 50%),
    radial-gradient(ellipse 50% 50% at 90% 80%, hsl(26 100% 60% / 0.15) 0%, transparent 50%),
    radial-gradient(ellipse 80% 30% at 50% 90%, hsl(217 33% 24% / 0.2) 0%, transparent 40%)
  `,
  text: {
    primary: 'linear-gradient(135deg, hsl(150 48% 18%) 0%, hsl(150 45% 35%) 100%)',
    accent: 'linear-gradient(135deg, hsl(26 100% 60%) 0%, hsl(26 100% 73%) 100%)',
  },
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
};
