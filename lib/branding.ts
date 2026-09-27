import { z } from 'zod';

// Einzige Quelle für die Hex-Farbe-Prüfung — vom Schreibpfad (Zod-Schema),
// vom Konsum-Pfad (`brandingToCSSVars`) und potenziell weiteren Stellen geteilt.
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}

// Matchday-Palette (ADR-007). Ein Verein mit genau diesen Werten hat kein
// eigenes Branding — dann gelten die themefähigen Token aus globals.css.
const DEFAULT_COLORS = {
  primaryColor: '#172C48',
  secondaryColor: '#255B9B',
  accentColor: '#D8F449',
};

export const ClubBrandingSchema = z.object({
  clubId: z.string().uuid('UUID required'),
  brand: z.object({
    primaryColor: z
      .string()
      .regex(HEX_COLOR_REGEX, 'Hex color required')
      .default(DEFAULT_COLORS.primaryColor),
    secondaryColor: z
      .string()
      .regex(HEX_COLOR_REGEX, 'Hex color required')
      .default(DEFAULT_COLORS.secondaryColor),
    accentColor: z
      .string()
      .regex(HEX_COLOR_REGEX, 'Hex color required')
      .default(DEFAULT_COLORS.accentColor),
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
  brand: { ...DEFAULT_COLORS },
  logos: { light: null, dark: null, favicon: null },
  customDomain: null,
  extended: {},
};

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

  // Defense-in-Depth: `hexToHsl` kann bei ungültigem Input nur NaN liefern.
  // Stattdessen wird hier explizit validiert und auf den Marken-Default
  // zurückgefallen — schützt auch vor Alt-/Korrupt-Daten aus der DB, die den
  // Zod-Schreibpfad umgangen haben (z. B. vor Einführung der Validierung).
  const safeColor = (value: string, fallback: string) => (isHexColor(value) ? value : fallback);

  // Nur echte Vereinsfarben überschreiben die Token. Ohne diese Sperre
  // landeten die Default-Werte als `:root{…}` über den Theme-Token — in beiden
  // Themes gleich, also im Dark-Theme Nachtblau auf Nachtblau.
  // ponytail: eine eigene Vereinsfarbe gilt weiterhin für Hell und Dunkel
  // gleich; wenn Vereine davon Gebrauch machen, je Theme ableiten.
  const vars: Record<string, string> = {};
  const set = (name: string, value: string, fallback: string) => {
    const color = safeColor(value, fallback);
    if (color.toLowerCase() !== fallback.toLowerCase()) vars[name] = hexToHsl(color);
  };
  set('--brand-primary', brand.primaryColor, DEFAULT_COLORS.primaryColor);
  set('--brand-secondary', brand.secondaryColor, DEFAULT_COLORS.secondaryColor);
  set('--brand-accent', brand.accentColor, DEFAULT_COLORS.accentColor);
  return vars;
}
