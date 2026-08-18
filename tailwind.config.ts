import type { Config } from 'tailwindcss';
import { colors, typography, shadows, radius } from './styles/theme';
import tailwindAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  // Strings im Code, die wie Arbitrary-Klassen aussehen (z. B. Regex /[-:T.Z]/
  // in lib/billing/datev-mapper.ts), aber keine sind — sonst generiert
  // Tailwind daraus ungültiges CSS und der Build bricht.
  blocklist: ['[-:T.Z]'],
  // `bg-gradient-hero` und `bg-gradient-accent` fielen am 18.08.2026 weg —
  // beide Verläufe hatten keine Verwendung mehr (siehe globals.css).
  safelist: ['bg-gradient-primary', 'animate-shimmer'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        brand: {
          primary: 'hsl(var(--brand-primary))',
          light: 'hsl(var(--brand-primary-light))',
          dark: 'hsl(var(--brand-dark))',
          secondary: 'hsl(var(--brand-secondary))',
          // Orange-Skala aus theme.ts + DEFAULT via CSS-Variable: `bg-brand-accent`
          // bleibt unverändert, `bg-brand-accent-100` etc. ersetzen die früheren
          // hartcodierten `orange-*`-Klassen.
          accent: { DEFAULT: 'hsl(var(--brand-accent))', ...colors.accent },
          // Terrakotta — Zustände zwischen gut und kaputt (Warteliste, wartet
          // auf Freigabe). Siehe Begründung an `--brand-accent-2`.
          'accent-2': 'hsl(var(--brand-accent-2))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          dark: 'hsl(var(--surface-elevated))',
          elevated: 'hsl(var(--surface-elevated))',
        },
        gray: colors.gray,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
      },
      // ── Statusfarben: Flächen und Text getrennt themefähig ──
      // `colors.*` oben bleibt die statische Skala und bedient alles, was
      // hier nicht überschrieben wird (ring-, divide-, from-/to-, shadow-).
      // Darunter wird pro Utility nur das Ende der Skala auf CSS-Variablen
      // gehoben, das im Dark Mode kippen muss:
      //   backgroundColor 50–300  Flächen  → dark: dunkle Tönung
      //   borderColor    100–300  Rahmen   → dark: dunkle Tönung
      //   textColor      600–900  Text     → dark: heller Ton
      // Absicht der Trennung: `bg-info-600 text-white` (gefüllter Button)
      // und `dark:bg-error-900` bleiben statisch und damit dunkel, während
      // `bg-error-50 text-error-600` in beiden Themes lesbar ist.
      // Tailwind merged `extend` auf dieser Ebene flach — deshalb muss die
      // komplette Skala gespreizt werden, nicht nur die geänderten Stufen.
      backgroundColor: Object.fromEntries(
        (['success', 'warning', 'error', 'info'] as const).map((name) => [
          name,
          {
            ...colors[name],
            50: `hsl(var(--${name}-50))`,
            100: `hsl(var(--${name}-100))`,
            200: `hsl(var(--${name}-200))`,
            300: `hsl(var(--${name}-300))`,
          },
        ])
      ),
      borderColor: Object.fromEntries(
        (['success', 'warning', 'error', 'info'] as const).map((name) => [
          name,
          {
            ...colors[name],
            100: `hsl(var(--${name}-100))`,
            200: `hsl(var(--${name}-200))`,
            300: `hsl(var(--${name}-300))`,
          },
        ])
      ),
      textColor: Object.fromEntries(
        (['success', 'warning', 'error', 'info'] as const).map((name) => [
          name,
          {
            ...colors[name],
            600: `hsl(var(--${name}-text-600))`,
            700: `hsl(var(--${name}-text-700))`,
            800: `hsl(var(--${name}-text-800))`,
            900: `hsl(var(--${name}-text-900))`,
          },
        ])
      ),
      ringColor: {
        brand: 'hsl(var(--brand-primary) / 0.7)',
      },
      fontFamily: {
        sans: typography.fontFamily.sans,
        display: typography.fontFamily.display,
        mono: typography.fontFamily.mono,
      },
      fontSize: {
        '3xs': typography.fontSize['3xs'],
        '2xs': typography.fontSize['2xs'],
        'display-1': ['3.75rem', { lineHeight: '1.1', fontWeight: '800' }],
        'display-2': ['3rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-3': ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-4': ['1.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        'hero-xl': ['4.5rem', { lineHeight: '1.1', fontWeight: '800' }],
        'hero-lg': ['3.75rem', { lineHeight: '1.15', fontWeight: '800' }],
        'hero-md': ['3rem', { lineHeight: '1.2', fontWeight: '700' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '28': '7rem',
        '32': '8rem',
      },
      borderRadius: {
        ...radius,
      },
      boxShadow: {
        // ── Schattenskala neu definiert (18.08.2026) ──
        // Tailwind-Default ist neutralgrau und für einen weissen Grund gebaut.
        // Auf dem warmen Clay-Grund liest sich das als grauer Schmutzrand, und
        // weil `shadow-sm` in 163 Dateien steht, war das der Grundton der ganzen
        // App: jede Fläche schwebt ein bisschen, keine steht.
        // Die Skala hier ist warm getönt (hue 40, die Grundfarbe) und deutlich
        // flacher — `sm` ist praktisch nur noch eine Kontaktkante. Wer wirklich
        // Höhe braucht, nimmt `md`/`lg`; `xl`/`2xl` bleiben Overlays vorbehalten.
        sm: '0 1px 1px hsl(40 20% 8% / 0.04)',
        DEFAULT: '0 1px 2px hsl(40 20% 8% / 0.05), 0 1px 1px hsl(40 20% 8% / 0.03)',
        md: '0 2px 4px -1px hsl(40 20% 8% / 0.06), 0 1px 2px hsl(40 20% 8% / 0.04)',
        lg: '0 6px 12px -4px hsl(40 20% 8% / 0.08), 0 2px 4px -2px hsl(40 20% 8% / 0.05)',
        xl: '0 12px 24px -8px hsl(40 20% 8% / 0.10), 0 4px 8px -4px hsl(40 20% 8% / 0.06)',
        '2xl': '0 24px 48px -16px hsl(40 20% 8% / 0.14)',
        soft: shadows.md,
        medium: shadows.lg,
        strong: shadows.xl,
        'glow-primary-sm': shadows.glow.primary,
        'glow-primary': shadows.glow.primaryStrong,
        premium:
          '0 24px 64px -16px rgba(0,0,0,0.15), 0 8px 32px -8px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.1) inset',
      },
      backgroundImage: {
        'gradient-primary':
          'linear-gradient(135deg, hsl(var(--brand-primary)) 0%, hsl(var(--brand-primary-light)) 100%)',
      },
      transitionDuration: {
        '400': '400ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        gentle: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      keyframes: {
        // Keyframes are defined as Single Source of Truth in app/globals.css.
        // Only aurora + slide-down remain here (they have no globals.css equivalent).
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-4px) scaleY(0.98)', maxHeight: '0' },
          '100%': { opacity: '1', transform: 'translateY(0) scaleY(1)', maxHeight: '500px' },
        },
      },
      animation: {
        // Keyframe bodies are in app/globals.css (Single Source of Truth).
        // Only aurora + slide-down keyframes remain in this file.
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-down': 'slide-down 0.25s ease-out forwards',
      },
    },
  },
  plugins: [tailwindAnimate],
};
export default config;
