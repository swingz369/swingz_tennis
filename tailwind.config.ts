import type { Config } from 'tailwindcss';
import { colors, typography, shadows, gradients, radius } from './styles/theme';
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
  safelist: [
    'bg-gradient-hero',
    'bg-gradient-primary',
    'bg-gradient-accent',
    'bg-gradient-mesh',
    'bg-gradient-radial',
    'rounded-bubble',
    'animate-shimmer',
  ],
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
          'accent-dashboard': 'hsl(var(--brand-accent-dashboard))',
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
      ringColor: {
        brand: 'hsl(var(--brand-primary) / 0.7)',
      },
      fontFamily: {
        sans: typography.fontFamily.sans,
        display: typography.fontFamily.display,
        editorial: typography.fontFamily.editorial,
        mono: typography.fontFamily.mono,
      },
      fontSize: {
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
        soft: shadows.md,
        medium: shadows.lg,
        strong: shadows.xl,
        'glow-primary-sm': shadows.glow.primary,
        'glow-primary': shadows.glow.primaryStrong,
        'glow-accent-sm': shadows.glow.accent,
        'glow-accent': shadows.glow.accentStrong,
        glass: '0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.1)',
        elegant:
          '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.02)',
        premium:
          '0 24px 64px -16px rgba(0,0,0,0.15), 0 8px 32px -8px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.1) inset',
      },
      backgroundImage: {
        'gradient-primary':
          'linear-gradient(135deg, hsl(var(--brand-primary)) 0%, hsl(var(--brand-primary-light)) 100%)',
        'gradient-accent':
          'linear-gradient(135deg, hsl(var(--brand-accent)) 0%, hsl(77 71% 62%) 100%)',
        'gradient-warm':
          'linear-gradient(135deg, hsl(var(--brand-accent)) 0%, hsl(var(--brand-primary-light)) 100%)',
        'gradient-hero': gradients.hero,
        'gradient-mesh': gradients.mesh,
        'gradient-radial': gradients.primaryRadial,
        'gradient-card':
          'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)',
        'gradient-shine':
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
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
        aurora: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: '0.6' },
          '33%': { transform: 'translateY(-30px) rotate(5deg) scale(1.1)', opacity: '0.8' },
          '66%': { transform: 'translateY(20px) rotate(-3deg) scale(0.95)', opacity: '0.5' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-4px) scaleY(0.98)', maxHeight: '0' },
          '100%': { opacity: '1', transform: 'translateY(0) scaleY(1)', maxHeight: '500px' },
        },
      },
      animation: {
        // Keyframe bodies are in app/globals.css (Single Source of Truth).
        // Only aurora + slide-down keyframes remain in this file.
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-right': 'slide-in-right 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slide-in-left 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        aurora: 'aurora 15s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'slide-down': 'slide-down 0.25s ease-out forwards',
      },
    },
  },
  plugins: [tailwindAnimate],
};
export default config;
