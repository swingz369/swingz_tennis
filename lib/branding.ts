import { z } from 'zod';

export const ClubBrandingSchema = z.object({
  clubId: z.string().uuid('UUID required'),
  brand: z.object({
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
      .default('#1B4332'),
    secondaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
      .default('#1e3a5f'),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')
      .default('#FF6B35'),
  }),
  logos: z.object({
    light: z.string().url().optional().nullable(),
    dark: z.string().url().optional().nullable(),
    favicon: z.string().url().optional().nullable(),
  }),
  customDomain: z.string().url().optional().nullable(),
  extended: z.record(z.any()).optional(),
});

export type ClubBranding = z.infer<typeof ClubBrandingSchema>;

export const DEFAULT_BRANDING: ClubBranding = {
  clubId: '',
  brand: {
    primaryColor: '#1B4332',
    secondaryColor: '#1e3a5f',
    accentColor: '#FF6B35',
  },
  logos: { light: null, dark: null, favicon: null },
  customDomain: null,
  extended: {},
};

export function mergeBranding(custom: Partial<ClubBranding> = {}): ClubBranding {
  return {
    ...DEFAULT_BRANDING,
    ...custom,
    brand: {
      ...DEFAULT_BRANDING.brand,
      ...custom.brand,
    },
    logos: {
      ...DEFAULT_BRANDING.logos,
      ...custom.logos,
    },
  };
}

export function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return `0 0% ${Math.round(l * 100)}%`;

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function brandingToCSSVars(branding: ClubBranding): Record<string, string> {
  const { brand } = branding;

  return {
    '--brand-primary': hexToHsl(brand.primaryColor),
    '--brand-secondary': hexToHsl(brand.secondaryColor),
    '--brand-accent': hexToHsl(brand.accentColor),
  };
}
