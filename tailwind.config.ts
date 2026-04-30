import type { Config } from 'tailwindcss';
import { colors, typography, shadows, gradients, radius } from './styles/theme';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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
          primary: colors.primary,
          secondary: colors.secondary,
          accent: colors.accent,
        },
        brandPrimary: colors.primary[600],
        brandSecondary: colors.secondary[900],
        brandAccent: colors.accent[500],
        brandBackground: '#ffffff',
        gray: colors.gray,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
      },
      ringColor: {
        brand: 'rgba(27, 67, 50, 0.7)',
      },
      fontFamily: {
        sans: typography.fontFamily.sans,
        serif: typography.fontFamily.serif,
      },
      fontSize: {
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
        'glow-green-sm': shadows.primaryGlow,
        'glow-green': shadows.primaryGlowStrong,
        'glow-orange-sm': shadows.accentGlow,
        'glow-orange': shadows.accentGlowStrong,
        glass: '0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.1)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #1B4332 0%, #40916C 100%)',
        'gradient-accent': 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%)',
        'gradient-hero': gradients.hero,
        'gradient-mesh': gradients.mesh,
        'gradient-radial': gradients.primaryRadial,
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
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(27, 67, 50, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(27, 67, 50, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
