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

export function brandingToCSSVars(branding: ClubBranding): Record<string, string> {
  const { brand } = branding;
  const hexToHsl = (hex: string): string => {
    const map: Record<string, string> = {
      '#1B4332': '150 48% 18%',
      '#1e3a5f': '217 33% 24%',
      '#FF6B35': '26 100% 68%',
    };
    return map[hex.toLowerCase()] || '0 0% 0%';
  };

  return {
    '--brand-primary': hexToHsl(brand.primaryColor),
    '--brand-secondary': hexToHsl(brand.secondaryColor),
    '--brand-accent': hexToHsl(brand.accentColor),
  };
}
