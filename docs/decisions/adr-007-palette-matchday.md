# ADR-007: Palette „Matchday“ — Nachtblau führt, Lime nur als Fläche

- **Status:** akzeptiert
- **Datum:** 27. September 2026
- **Löst ab:** die Palette „Clay“ (warmes Neutral + Tennisgrün, Kommentar in `app/globals.css`, Stand bis 26.09.2026)
- **Betrifft:** `app/globals.css` (alle Farb-Token), `tailwind.config.ts`, `app/layout.tsx` (`themeColor`), `public/manifest.json`, `lib/branding.ts` (`DEFAULT_BRANDING`)
- **Grundlage:** Designentwurf „SwingZ Matchday“ (interaktiver Prototyp, 27.09.2026), vom Auftraggeber freigegeben

## Kontext

Clay hatte das frühere „kühle Blaugrau + Lime“ ersetzt, weil Lime als **Akzentfarbe auf hellem
Grund** zu wenig Kontrast hatte (Lime #D8F449 auf Weiß: 1,2:1). Der Matchday-Entwurf bringt
Nachtblau und Lime zurück, setzt Lime aber anders ein: nur als **Fläche mit nachtblauer Schrift**
(11,4:1) — für die wichtigste Aktion einer Seite und den aktiven Navigationspunkt.

In der App wird `--primary` aber auch als Textfarbe benutzt (`text-primary` 172×,
`text-brand-primary` 61×, dazu Rahmen). Lime direkt auf `--primary` zu legen, hätte das alte
Kontrastproblem an über 200 Stellen zurückgebracht.

## Entscheidung

| Token                             | Hell                             | Dunkel                                          |
| --------------------------------- | -------------------------------- | ----------------------------------------------- |
| `--primary`                       | Nachtblau #172C48, weiße Schrift | Lime #D8F449, nachtblaue Schrift                |
| `--highlight` (neu)               | Lime #D8F449, nachtblaue Schrift | Lime                                            |
| `--ring`, `--brand-primary-light` | Blau #255B9B                     | #A9CBFF                                         |
| `--brand-accent` (Text)           | Oliv #5B6A00                     | Lime                                            |
| Dunkle Inseln (Sidebar, Hero)     | Nachtblau                        | Sidebar tiefer (#0C1522), Hero heller (#24406A) |

1. **Lime ist nie Textfarbe auf hellem Grund.** Wer Lime braucht, nimmt `bg-highlight
text-highlight-foreground` — höchstens eine solche Aktion pro Seite.
2. **Weiße Schrift auf `bg-primary` ist verboten**, weil `--primary` im Dunkel-Theme hell ist.
   Immer `text-primary-foreground`.
3. **Kontraste werden geprüft, nicht behauptet:** `src/__tests__/lib/design-tokens-contrast.test.ts`
   liest die Token aus `globals.css` und verlangt 4,5:1 für Text, 3:1 für Grafik.

## Verworfene Alternativen

- **`--primary` = Lime in beiden Themes.** Macht jeden Standard-Button gelb (der Entwurf will genau
  eine hervorgehobene Aktion) und jeden `text-primary`-Text unlesbar.
- **Clay behalten.** Vom Auftraggeber nach Vergleich im Prototyp abgelehnt.

## Folgen

- Die Statusfarben (success/warning/error/info) bleiben unverändert — farbneutral und schon
  themefähig.
- Wer ein neues Farb-Token einführt, ergänzt das Paar im Kontrast-Test.
