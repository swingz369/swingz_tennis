# Design-System-Audit — 16.08.2026

> Snapshot. Methode: statische Analyse von 460 UI-Dateien (`app/`, `components/`, `lib/`, `src/`, `styles/`)
> gegen `styles/theme.ts`, `tailwind.config.ts`, `app/globals.css`, `design-tokens.json`, `docs/DESIGN.md`.
> Kontrastwerte berechnet (WCAG 2.1 relative Luminanz) aus den HSL-Tokens in `app/globals.css`.
> Kein Browser-Durchlauf — visuelle Dichte und Hover-/Loading-States nur aus dem Code beurteilt.

**Gesamt: 72/100.** Das System ist erstaunlich diszipliniert: 2 rohe Tailwind-Paletten-Klassen
im gesamten Code, eine einzige Token-Quelle, vollständige Dark-Variablen. Die Probleme liegen
woanders — in einer Token-Datei, die seit drei Monaten lügt, und in einer Statusfarben-Skala,
die vom Theme gar nichts weiß.

---

## Scorecard

| #   | Dimension              | Score    | Kernbefund                                                                          |
| --- | ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| 1   | Farbkonsistenz         | 8/10     | Nur 2 rohe Paletten-Klassen — aber `design-tokens.json` ist zu 100 % veraltet       |
| 2   | Typografie-Hierarchie  | 7/10     | Display-Skala sauber; 34 × Schrift unter 12px per Arbitrary-Wert                    |
| 3   | Spacing-Rhythmus       | 8/10     | 168 Arbitrary-Größen, überwiegend Kalender-Pixelgeometrie (legitim)                 |
| 4   | Komponenten-Konsistenz | 7/10     | Zwei Radius-Systeme nebeneinander: `rounded-xl` (557) vs. shadcn `rounded-md` (106) |
| 5   | Responsive             | 8/10     | Standard-Breakpoints, keine Ad-hoc-Media-Queries im Code                            |
| 6   | **Dark Mode**          | **5/10** | **182 Stellen mit `bg-success/warning/error/info-50…200` ohne `dark:`-Variante**    |
| 7   | Animation              | 8/10     | Fast nur Skeletons; `prefers-reduced-motion` global behandelt                       |
| 8   | **Accessibility**      | **6/10** | **`text-brand-accent` = 3.56:1 im Light Mode, 53 Verwendungen**                     |
| 9   | Informationsdichte     | 7/10     | Mini-Schriften ballen sich in Kalender/Dashboard                                    |
| 10  | Politur                | 8/10     | 28 von 65 Utility-Klassen in `globals.css` werden nirgends benutzt                  |

---

## P1 — Dark Mode: Statusfarben kennen kein Theme

`styles/theme.ts` definiert `success`/`warning`/`error`/`info` als **statische Hex-Skalen**
(Tailwind-Defaults). Anders als `--brand-*`, `--surface` usw. laufen sie nicht über CSS-Variablen,
haben also im Dark Mode exakt denselben Wert. `bg-success-50` ist `#f0fdf4` — ein fast weißer
Block auf dunklem Grund.

**182 Stellen in 62 Dateien** benutzen `bg-{status}-50|100|200` ohne begleitende `dark:`-Variante.
Insgesamt haben nur 430 von 1159 Statusfarben-Zeilen (37 %) überhaupt eine Dark-Behandlung.

Schwerpunkte:

| Stellen | Datei                                                      |
| ------- | ---------------------------------------------------------- |
| 12      | `components/admin/dry-run-panel.tsx`                       |
| 12      | `lib/rsvp-status.tsx`                                      |
| 9       | `components/unified-court-calendar.tsx`                    |
| 8       | `components/partner-finder-panel.tsx`                      |
| 7       | `app/(protected)/bookings/page.tsx`                        |
| 7       | `app/(protected)/admin/(gated)/pricing/pricing-client.tsx` |
| 7       | `components/season-planning/conflict-list.tsx`             |
| 7       | `components/churn-risk-panel.tsx`                          |

Belege:

- `app/login/page.tsx:224` — `rounded-xl bg-error-50 p-4 text-sm text-error-600 border border-error-100`
- `app/reset-password/page.tsx:307` — dieselbe Fehlerbox, dieselbe Lücke
- `app/support/page.tsx:180,187,194` — `bg-info-50 text-info-600` als Prop durchgereicht
- `app/(protected)/bookings/error.tsx:26` — `text-error-500 bg-error-50`

**Fix (eine Stelle statt 182):** die vier Skalen wie `--brand-*` auf CSS-Variablen umstellen —
`success: { 50: 'hsl(var(--success-50))', … }` in `tailwind.config.ts`, Werte in `:root`/`.dark`
in `app/globals.css`. Danach greift jede der 182 Stellen automatisch. Die Alternative — 182 ×
`dark:bg-…` nachtragen — löst dasselbe Problem 182 Mal und geht beim nächsten Feature wieder auf.

---

## P1 — `design-tokens.json` ist vollständig veraltet

Die Datei behauptet `"lastAudited": "2026-05-15"` und `_generatedFrom: styles/theme.ts + tailwind.config.ts`.
**Kein einziger Brand-Wert stimmt noch:**

| Token                   | `design-tokens.json`           | `app/globals.css` (live)                         |
| ----------------------- | ------------------------------ | ------------------------------------------------ |
| `--brand-primary`       | `150 48% 18%` (#1B4332)        | `152 56% 28%` (#1F6F4A)                          |
| `--brand-primary-light` | `150 45% 35%`                  | `152 40% 42%`                                    |
| `--brand-secondary`     | `217 33% 24%` (Navy)           | `162 33% 20%` (Grün)                             |
| `--brand-accent`        | `26 100% 60%` (Orange #FF6B35) | `44 70% 36%` (Gold), dark `77 71% 50%` (Limette) |
| `--surface`             | `0 0% 100%`                    | `40 27% 98%`                                     |
| `--text-primary`        | `150 20% 10%`                  | `160 23% 10%`                                    |

Dazu kennt die Datei 11 Light-/9 Dark-Variablen, während `:root` real 31 Farbvariablen führt
(`--brand-accent-2`, `--surface-elevated`, `--destructive`, die komplette shadcn-Ebene fehlen).
Der Abschnitt `migrationGuide.hardcodedHex` verweist auf eine Migration, die längst gelaufen ist.

Wer diese Datei als Referenz nimmt, baut in Orange und Navy — die App ist Grün und Gold.

**Fix:** löschen. `styles/theme.ts` + `app/globals.css` sind die tatsächliche Quelle, `docs/DESIGN.md`
die gepflegte Beschreibung; eine dritte, nicht generierte Kopie hat kein Zuhause in der
Doku-Governance (`AGENTS.md` § 1: weder lebend noch generiert). Wenn ein Token-Export für
Design-Tools gebraucht wird: aus `theme.ts` generieren und in `.gitignore`.

---

## P2 — `text-brand-accent` fällt durch WCAG AA

Berechnete Kontraste gegen `--background`:

| Paar                              | Light                | Dark    |
| --------------------------------- | -------------------- | ------- |
| `foreground` / `background`       | 14.97 ✓              | 15.95 ✓ |
| `muted-foreground` / `background` | 4.84 ✓               | 6.32 ✓  |
| `primary` / `background`          | 5.42 ✓               | 7.49 ✓  |
| **`brand-accent` / `background`** | **3.56 ✗** (AA: 4.5) | 11.38 ✓ |
| `brand-accent-2` / `background`   | 4.53 ✓               | 7.19 ✓  |
| `destructive` / `background`      | 4.92 ✓               | 7.01 ✓  |

53 Verwendungen von `text-brand-accent`. Bei Icons ist 3:1 ausreichend (WCAG 1.4.11), bei Text nicht:

- `app/(marketing)/landing/page.tsx:219` — `text-sm font-semibold uppercase tracking-wider text-brand-accent` (Eyebrow-Text)
- `app/about/page.tsx:69,149,225` — Badge-Text auf `bg-brand-accent/10`, dort ist der Kontrast noch schlechter als 3.56
- `app/login/page.tsx:124`, `app/(marketing)/landing/page.tsx:156` — Icons, unkritisch

**Fix:** `--brand-accent` im Light Mode abdunkeln (`44 70% 30%` → ~4.6:1) oder für Textnutzung
`text-brand-accent-700` aus der vorhandenen Accent-Skala verwenden. Icons dürfen bleiben.

**Bewusst niedrig, kein Befund:** `--border` (1.18:1) und `--border-subtle` (1.15:1). `app/globals.css`
begründet die Trennung im Kommentar — `--input` (3.07:1) trägt die WCAG-1.4.11-Pflicht, dekorative
Kartenrahmen nicht. Das ist korrekt und soll so bleiben.

---

## ~~P2 — 28 Stellen mit `outline-none` ohne Ersatz-Fokusring~~ — Fehlbefund

**Zurückgezogen am 16.08.2026.** Der ursprüngliche Scan prüfte nur, ob in derselben _Zeile_
`focus-visible` steht, und übersah damit jeden Ring, der ein paar Zeichen weiter in derselben
`className` folgt. Nachgezählt über die vollständige Klassenliste: von 48 `outline-none`-Stellen
ersetzen **40** den Outline durch einen sichtbaren Ring (`focus:ring-2 focus:ring-primary`,
`app/error.tsx:73,80` und `app/contact/contact-form-client.tsx:120` gehören dazu). Die
restlichen **8** sind shadcn-Menüeinträge (`dropdown-menu.tsx`, `command.tsx`, `select.tsx`),
die den Fokus über einen Flächenwechsel anzeigen (`focus:bg-accent`, `aria-selected:bg-muted`) —
ebenfalls ein gültiger sichtbarer Fokusindikator.

Hier war nichts zu reparieren.

---

## P3 — `app/(public)/design-preview/page.tsx` ist die vierte Wahrheit

Die Preview-Seite hält die Palette als hartkodierte Hex-Paare (Zeilen 16–24) statt sie aus den
CSS-Variablen zu lesen. Zwei Werte sind bereits falsch:

| Token                   | Preview behauptet (dark) | Real (dark)      |
| ----------------------- | ------------------------ | ---------------- |
| `--brand-primary`       | `#50ACDE` (Blau)         | `#3DB87E` (Grün) |
| `--brand-primary-light` | `#84C6E8` (Blau)         | `#72CAA1` (Grün) |

Eine Seite, die das Design-System zeigen soll, zeigt eine blaue Marke. **Fix:** Swatches per
`getComputedStyle(document.documentElement).getPropertyValue('--brand-primary')` rendern —
dann kann sie gar nicht mehr driften.

---

## P3 — Toter Code in `app/globals.css`

28 von 65 selbst definierten Utility-Klassen werden nirgends im Code verwendet:

```
animate-in-delay-5, reveal-delay-1…4, safe-area-pt/pl/pr/mt/mb,
overlay-gradient-t/b, min-h-viewport, font-editorial, editorial-display,
editorial-eyebrow, hairline-t/b/x/y, hairline-clay-t, paper-grain,
rule-clay, rule-forest, link-mask, hero-video-layer,
hero-progress-sentinel, hero-headline-accent
```

Dazu in `tailwind.config.ts` nie benutzt: `bg-gradient-mesh`, `bg-gradient-radial`,
`bg-gradient-warm`, `bg-gradient-card`, `bg-gradient-shine`, `rounded-bubble`,
`fontFamily.editorial`. Drei davon stehen in der `safelist` und werden deshalb garantiert
mit ausgeliefert, obwohl sie niemand aufruft.

Das „Editorial"-Set (`font-editorial`, `editorial-display`, `editorial-eyebrow`, `hairline-*`,
`rule-clay`, `paper-grain`) sieht nach einer verworfenen Design-Richtung aus — nur
`.theme-editorial` wird noch 2× referenziert.

---

## P3 — Zwei Radius-Systeme

| Klasse         | Vorkommen |
| -------------- | --------- |
| `rounded-xl`   | 557       |
| `rounded-full` | 251       |
| `rounded-md`   | 106       |
| `rounded-lg`   | 8         |

`rounded-xl` ist die Projektnorm, `rounded-md` kommt aus den unveränderten shadcn-Primitives
(`components/ui/select.tsx` usw.). Das ist tolerierbar. Die 8 `rounded-lg` sind reine Ausreißer
und sollten `rounded-xl` werden:

`app/dev/page.tsx:186` · `app/(public)/status/page.tsx:106` · `app/(protected)/member/family/page.tsx:166` ·
`app/(protected)/admin/(gated)/leagues/leagues-client.tsx:317,395` · `components/dev/copy-command.tsx:25` ·
`components/layout/owner-club-banner.tsx:67` · `components/layout/global-search.tsx:282`

---

## P3 — Schrift unter 12px

34 Arbitrary-Werte `text-[8px]` … `text-[11.5px]` in 16 Dateien, Schwerpunkt
`components/unified-court-calendar.tsx` (12) und `lib/season-planning/schedule-grid.tsx` (9).
In dichten Kalenderrastern nachvollziehbar, aber `text-[8px]` (2 ×) ist unter jeder
Lesbarkeitsschwelle. `tailwind.config.ts` hat bereits `text-2xs` — die Zwischengrößen
(`[11.5px]`, `[13.5px]`, `[10.5px]`) gehören dorthin statt in den Markup.

---

## Kein Befund (geprüft, sauber)

- **Rohe Tailwind-Paletten-Farben:** 2 Stellen im ganzen Repo (`app/(public)/status/page.tsx`).
  Die Umbenennung auf `success-*`/`warning-*`/`error-*`/`info-*` ist praktisch vollständig durchgezogen.
- **Hex im Markup:** 134 Treffer, davon nahezu alle legitim — Chart-Bibliotheken
  (`components/admin/pie-chart.tsx`, `analytics-charts.tsx`), PDF (`lib/pdf/invoice-pdf.tsx`),
  E-Mail-Templates (`lib/season-planning/email-templates/`) und die Vereins-Branding-Defaults
  (`branding-client.tsx`). Keins davon kann CSS-Variablen benutzen.
- **KI-Slop:** keiner. 48 `bg-gradient-to-*` verteilt über Marketing-/Auth-Seiten, keine
  Purple-to-Blue-Defaults, 24 × `backdrop-blur` gezielt eingesetzt. Von 22 `animate-pulse`-Treffern
  sind 20 Skeletons oder Live-Indikatoren.
- **Dark-Variablen:** 30 von 31 Farbvariablen haben ein `.dark`-Gegenstück. Die 18 ohne Override
  sind Easings, Z-Index, Blur und Durations — korrekt.
- **`docs/DESIGN.md`:** stimmt. Die einzige Hex-Zeile (79, Status-Farben) deckt sich mit `styles/theme.ts`.
- **Klickbare `<div>`s ohne Rolle:** 0.

---

## Umsetzung — 16.08.2026

Alles unten Stehende ist erledigt und mit `npx tsc --noEmit` (0 Fehler), `npx next build`
(erfolgreich) und `bash scripts/check-design-tokens.sh` (grün) belegt.

**1. Statusfarben themefähig — ohne eine einzige Komponentenänderung.**
Der ursprüngliche Vorschlag (Skala umdrehen) wurde beim Umsetzen verworfen: eine Messung ergab
**699 bereits vorhandene `dark:`-Deklarationen** auf Statusfarben und **35 gefüllte Buttons**
(`bg-info-600 text-white`) — beide Gruppen wären ins Gegenteil gekippt. Stattdessen sind die
Enden der Skala jetzt **pro Utility** verdrahtet (`tailwind.config.ts`):

| Utility           | Stufen                     | Quelle                    | Dark          |
| ----------------- | -------------------------- | ------------------------- | ------------- |
| `backgroundColor` | 50–300                     | `--{status}-{stufe}`      | dunkle Tönung |
| `borderColor`     | 100–300                    | `--{status}-{stufe}`      | dunkle Tönung |
| `textColor`       | 600–900                    | `--{status}-text-{stufe}` | heller Ton    |
| alles übrige      | 400/500, bg/border 600–900 | statisch                  | unverändert   |

Im kompilierten CSS geprüft: `bg-error-50` → `hsl(var(--error-50))`, `bg-error-900` →
`rgb(127 29 29)`, `text-error-600` → `hsl(var(--error-text-600))`, `text-error-300` → statisch.
Damit sind alle 1820 Basis-Verwendungen korrekt, ohne die 699 bestehenden `dark:`-Zeilen
anzufassen. Gemessene Dark-Kontraste `text-600` auf `bg-50`: success 10.9 · warning 10.0 ·
error 7.0 · info 7.6.
Einzige Komponentenänderung: `components/layout/owner-club-banner.tsx` zielte mit
`dark:bg-warning-300`/`dark:text-warning-900` genau auf die gedrehten Stufen und benutzt jetzt
die statischen (`dark:bg-warning-400 dark:text-gray-900`).

**2. `design-tokens.json` gelöscht** (+ Eintrag aus `knip.json`).
`docs/handbook/dev/theming-design-tokens.md` beschreibt jetzt die neue Statusfarben-Verdrahtung
und begründet, warum es keine vierte Token-Quelle mehr gibt.

**3. `--brand-accent` Light von 36 % auf 28 % Helligkeit.** Maßgeblich war nicht der Seitengrund
(dort hätten 31 % gereicht), sondern der engste reale Fall: Text auf der eigenen 10-%-Tönung
(`bg-brand-accent/10 text-brand-accent`, u. a. `components/ui/badge.tsx:12`) — 3,20:1 vorher,
4,69:1 jetzt. Gefüllte Flächen mit weisser Schrift gewinnen mit (4,03 → 6,07:1).

**4. Fokusringe — Fehlbefund, siehe oben.** Nichts geändert.

**5. Aufgeräumt.** 189 Zeilen aus `globals.css`: das komplette Editorial-/Hero-Video-Set
(dessen Komponenten und `docs/hero-video-briefing.md` längst gelöscht sind), `.theme-editorial`
(nirgends gesetzt, führte als letzte Stelle die alte Orange/Navy-Palette), fünf ungenutzte
`safe-area-*`, `reveal-delay-1..4`, `overlay-gradient-*`, `min-h-viewport`.
Dazu in `tailwind.config.ts`/`styles/theme.ts`: fünf ungenutzte Gradient-Utilities,
`rounded-bubble`, `fontFamily.editorial`, drei überflüssige Safelist-Einträge und der gesamte
`gradients`-Export bis auf `hero` (der Rest war die alte blaue Marke, hsl 206).
Preview-Seite liest die Werte jetzt per `getComputedStyle` statt sie zu behaupten.
Acht `rounded-lg` → `rounded-xl` und zwei `emerald-*` → `success-*`: damit ist
`scripts/check-design-tokens.sh` erstmals grün — der Guardrail existierte, schlug an, und lief nirgends.

**6. Schriftgrößen.** Neue kleinste Stufe `text-3xs` (9px). Migriert: `text-[8px]`/`[9px]`/`[9.5px]`
→ `text-3xs`, `[10px]`/`[10.5px]` → `text-2xs`, `[11.5px]` → `text-xs`, `[13.5px]` → `text-sm`.
Die zwei `text-[8px]` (unter jeder Lesbarkeitsschwelle) sind damit weg.

## Offen

- **`text-[11px]` (10 Stellen)** bleibt als Arbitrary-Wert: zwischen `text-2xs` (10px) und
  `text-xs` (12px) gibt es keine Stufe, und eine vierte Mikrogröße einzuführen wäre schlimmer
  als der sichtbare Rohwert. Ebenso unangetastet: `[12.5px]`, `[13px]`, `[15px]`, `[17px]`, `[34px]`.
- **Statusfarben im Light Mode.** Beim Rechnen aufgefallen, nicht Teil des Auftrags:
  `text-success-600` auf `bg-success-50` liegt bei **3,20:1**, `text-warning-600` auf
  `bg-warning-50` bei **3,04:1** — beide unter AA. Das betrifft jedes grüne und gelbe Badge im
  Light Mode. Der Fix wäre jetzt eine Zeile (`--success-text-600` abdunkeln), ändert aber das
  Erscheinungsbild sämtlicher Statusabzeichen — das ist eine Gestaltungsentscheidung, keine
  Reparatur, und wurde deshalb nicht im Vorbeigehen gemacht.
- **`bg-gradient-hero` ist blau** (`hsl 206`), der letzte Rest der Vorgängermarke. Wird einmal
  benutzt (Login). Auch das ist eine Gestaltungsfrage, kein Defekt.
