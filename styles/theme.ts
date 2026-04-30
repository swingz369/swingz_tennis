// SWINGZ Design Tokens – Professional Tennis Club Management
// Colors: Tennis Green + Navy + Orange Accent

export const colors = {
  // Primary – Forest Green (SwingZ Brand)
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
    // Brand exact color
    brand: '#1B4332', // Deep forest green – primary brand
  },
  // Secondary – Navy (SwingZ Brand)
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
    brand: '#1e3a5f', // Deep navy – secondary brand
  },
  // Accent – Orange (SwingZ Brand)
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
    brand: '#FF6B35', // Vibrant orange – accent brand
  },
  // Neutrals – Warm Grays
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  // Semantic
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    serif: ['"Playfair Display"', 'Georgia', 'serif'],
  },
  fontSize: {
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
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
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
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '3xl': '0 35px 60px -15px rgb(0 0 0 / 0.3)',
  // Colored Glow Shadows für CTAs und Fokus
  primaryGlow: '0 8px 24px -4px rgba(27, 67, 50, 0.5)',
  primaryGlowStrong: '0 12px 40px -8px rgba(27, 67, 50, 0.6)',
  accentGlow: '0 8px 24px -4px rgba(255, 107, 53, 0.5)',
  accentGlowStrong: '0 12px 40px -8px rgba(255, 107, 53, 0.6)',
  card: '0 2px 8px -2px rgb(0 0 0 / 0.08), 0 4px 12px -3px rgb(0 0 0 / 0.06)',
  cardHover: '0 12px 24px -4px rgb(0 0 0 / 0.12), 0 6px 12px -3px rgb(0 0 0 / 0.08)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
};

export const gradients = {
  primary: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #40916C 100%)',
  primaryRadial: 'radial-gradient(circle at 30% 20%, #40916C 0%, #1B4332 100%)',
  accent: 'linear-gradient(135deg, #FF6B35 0%, #FF8C5A 50%, #FF9E5C 100%)',
  accentWarm: 'linear-gradient(135deg, #FFB88C 0%, #FF9E5C 100%)',
  hero: 'linear-gradient(135deg, #0A3D2E 0%, #1B4332 50%, #2D6A4F 100%)',
  dark: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
  glass: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
  mesh: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 25%, #40916C 50%, #52B788 75%, #74C69D 100%)',
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
