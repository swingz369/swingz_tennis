import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ADR-007: Kontraste der Farb-Token werden geprüft, nicht behauptet.
// Liest die HSL-Token direkt aus app/globals.css — wer einen Wert ändert,
// sieht hier sofort, ob ein Text- oder Grafikpaar unter WCAG AA fällt.

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Block ${selector} fehlt in globals.css`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const tokens: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([\d.]+ [\d.]+% [\d.]+%);/g)) tokens[m[1]] = m[2];
  return tokens;
}

function luminance(hsl: string): number {
  const [h, s, l] = hsl.split(' ').map((v) => parseFloat(v));
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;
// [Vordergrund, Hintergrund, Mindestwert]
const PAIRS: [string, string, number][] = [
  ['foreground', 'background', TEXT],
  ['foreground', 'card', TEXT],
  ['muted-foreground', 'card', TEXT],
  ['muted-foreground', 'muted', TEXT],
  ['primary', 'card', TEXT],
  ['primary', 'background', TEXT],
  ['primary-foreground', 'primary', TEXT],
  ['highlight-foreground', 'highlight', TEXT],
  ['destructive', 'card', TEXT],
  ['destructive-foreground', 'destructive', TEXT],
  ['brand-primary', 'card', TEXT],
  ['brand-primary-light', 'card', TEXT],
  ['brand-accent', 'card', TEXT],
  ['input', 'card', GRAPHIC],
  ['ring', 'card', GRAPHIC],
  ['event', 'card', GRAPHIC],
];

describe('Farb-Token (ADR-007)', () => {
  const light = block(':root');
  const dark = { ...light, ...block('.dark') };

  for (const [theme, tokens] of [
    ['hell', light],
    ['dunkel', dark],
  ] as const) {
    it.each(PAIRS)(`${theme}: %s auf %s ≥ %s:1`, (fg, bg, min) => {
      expect(tokens[fg], `--${fg} fehlt`).toBeDefined();
      expect(tokens[bg], `--${bg} fehlt`).toBeDefined();
      expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
    });
  }

  it('Text auf der dunklen Insel (.brand-dark-surface) bleibt lesbar', () => {
    const island = block('.brand-dark-surface');
    for (const bg of [light['brand-dark'], dark['brand-dark']]) {
      expect(contrast(island['muted-foreground'], bg)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(island.foreground, bg)).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('Lime auf der dunklen Insel (Hero, Sidebar) bleibt lesbar', () => {
    expect(contrast(light.highlight, light['brand-dark'])).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(dark.highlight, dark['brand-dark'])).toBeGreaterThanOrEqual(TEXT);
  });
});
