// Kontrast-Sweep über die Design-Tokens in app/globals.css.
// Liest :root und .dark, rechnet HSL → sRGB → relative Luminanz → Ratio.
import { readFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');

function block(selector) {
  // Erster Vorkommnis des Selektors auf Top-Level (nicht .theme-editorial).
  const re = new RegExp(`(^|\\n)${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = css.match(re);
  if (!m) throw new Error(`Block ${selector} nicht gefunden`);
  const out = {};
  for (const line of m[2].split('\n')) {
    const t = line.match(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/);
    if (t) out[t[1]] = [Number(t[2]), Number(t[3]) / 100, Number(t[4]) / 100];
  }
  return out;
}

function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const t = h / 60;
  let r, g, b;
  if (t < 1) [r, g, b] = [c, x, 0];
  else if (t < 2) [r, g, b] = [x, c, 0];
  else if (t < 3) [r, g, b] = [0, c, x];
  else if (t < 4) [r, g, b] = [0, x, c];
  else if (t < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (rgb) => {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(hslToRgb(a)), lum(hslToRgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const hex = (t) =>
  '#' +
  hslToRgb(t)
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

// fg, bg, Mindestanforderung. 4.5 = AA Fliesstext, 3.0 = AA Grossschrift/UI-Grafik.
const PAIRS = [
  ['foreground', 'background', 4.5, 'Fliesstext auf Seite'],
  ['foreground', 'card', 4.5, 'Fliesstext auf Karte'],
  ['muted-foreground', 'background', 4.5, 'Sekundärtext auf Seite'],
  ['muted-foreground', 'card', 4.5, 'Sekundärtext auf Karte'],
  ['muted-foreground', 'muted', 4.5, 'Sekundärtext auf Muted-Fläche'],
  ['primary-foreground', 'primary', 4.5, 'Text auf Primary-Button'],
  ['destructive-foreground', 'destructive', 4.5, 'Text auf Destructive-Button'],
  ['secondary-foreground', 'secondary', 4.5, 'Text auf Secondary'],
  ['accent-foreground', 'accent', 4.5, 'Text auf Accent'],
  ['card-foreground', 'card', 4.5, 'Kartentext'],
  ['primary', 'background', 4.5, 'Link/Primary-Text auf Seite'],
  ['primary', 'card', 4.5, 'Link/Primary-Text auf Karte'],
  ['destructive', 'card', 4.5, 'Fehlertext auf Karte'],
  ['input', 'background', 3.0, 'Eingabefeld-Rahmen (WCAG 1.4.11)'],
  ['input', 'card', 3.0, 'Eingabefeld-Rahmen auf Karte'],
  ['ring', 'background', 3.0, 'Fokusring gegen Seite'],
  ['brand-accent', 'card', 3.0, 'Akzentfläche auf Karte'],
];

let failures = 0;
for (const [name, sel] of [
  ['Clay (light)', ':root'],
  ['Nocturne (dark)', '\\.dark'],
]) {
  const t = block(sel);
  console.log(`\n═══ ${name} ═══`);
  for (const [fg, bg, min, desc] of PAIRS) {
    if (!t[fg] || !t[bg]) {
      console.log(`  ?    ${desc} — Token fehlt (${fg}/${bg})`);
      continue;
    }
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'OK  ' : 'FAIL'} ${r.toFixed(2).padStart(5)} (min ${min})  ${desc.padEnd(34)} ${hex(t[fg])} auf ${hex(t[bg])}`
    );
  }
}
console.log(`\n${failures === 0 ? "Alle Paare bestehen AA." : `${failures} Paar(e) unter AA.`}`);
process.exit(failures === 0 ? 0 : 1);
