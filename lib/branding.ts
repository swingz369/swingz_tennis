[
  {
    zod: "export const ClubBrandingSchema = z.object({\n  clubId: z.string().uuid('UUID required')",
    brand: 'z.object({\n    primaryColor: z\n      .string()\n      .regex(/^#[0-9A-Fa-f]{6',
  },
  [
    '0-9',
    "A-Fa-f]{6}$/, 'Hex color required')\n      .default('#1e3a5f'),\n    accentColor: z\n      .string()\n      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color required')\n      .default('#FF6B35'),\n  }),\n  logos: z.object({\n    light: z.string().url().optional().nullable(),\n    dark: z.string().url().optional().nullable(),\n    favicon: z.string().url().optional().nullable(),\n  }),\n  customDomain: z.string().url().optional().nullable(),\n  extended: z.record(z.any()).optional(),\n});\n\nexport type ClubBranding = z.infer<typeof ClubBrandingSchema>;\n\nexport const DEFAULT_BRANDING: ClubBranding = {\n  clubId: '',\n  brand: {\n    primaryColor: '#1B4332',\n    secondaryColor: '#1e3a5f',\n    accentColor: '#FF6B35',\n  },\n  logos: { light: null, dark: null, favicon: null },\n  customDomain: null,\n  extended: {},\n};\n\nexport function mergeBranding(custom: Partial<ClubBranding> = {}): ClubBranding {\n  return {\n    ...DEFAULT_BRANDING,\n    ...custom,\n    brand: {\n      ...DEFAULT_BRANDING.brand,\n      ...custom.brand,\n    },\n    logos: {\n      ...DEFAULT_BRANDING.logos,\n      ...custom.logos,\n    },\n  };\n}\n\nexport function brandingToCSSVars(branding: ClubBranding): Record<string, string> {\n  const { brand } = branding;\n  const hexToHsl = (hex: string): string => {\n    // Quick mapping for known defaults; full converter could be added\n    const map: Record<string, string> = {\n      '#1B4332': '150 48% 18%',\n      '#1e3a5f': '217 33% 24%',\n      '#FF6B35': '26 100% 68%',\n    };\n    return map[hex.toLowerCase()] || '0 0% 0%';\n  };\n\n  return {\n    '--brand-primary': hexToHsl(brand.primaryColor),\n    '--brand-secondary': hexToHsl(brand.secondaryColor),\n    '--brand-accent': hexToHsl(brand.accentColor),\n  };\n}",
  ],
];
