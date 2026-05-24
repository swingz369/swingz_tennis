# 🎾 SwingZ Design System

> **Refined Elegance meets Athletic Performance** – Ein Premium-Designsystem für Tennis-Club-Management.
>
> Audit-Datum: 2026-05-22 | Version: 1.0

---

## Inhaltsverzeichnis

1. [Philosophie & Marken-Essenz](#1-philosophie--marken-essenz)
2. [Farbsystem](#2-farbsystem)
3. [Typografie](#3-typografie)
4. [Abstands-Skala (Spacing)](#4-abstands-skala-spacing)
5. [Border Radius](#5-border-radius)
6. [Schatten-System](#6-shadow-system)
7. [Gradienten-System](#7-gradienten-system)
8. [Glass-Morphism-System](#8-glass-morphism-system)
9. [Animation & Motion](#9-animation--motion)
10. [Utility-Klassen](#10-utility-klassen)
11. [Responsive Breakpoints](#11-responsive-breakpoints)
12. [Z-Index-Skala](#12-z-index-skala)
13. [Design Audit Scorecard](#13-design-audit-scorecard)
14. [Empfehlungen & Optimierungen](#14-empfehlungen--optimierungen)

---

## 1. Philosophie & Marken-Essenz

### Marken-Persönlichkeit

| Dimension          | Ausprägung                                                       |
| ------------------ | ---------------------------------------------------------------- |
| **Ton**            | Professionell, warm, einladend                                   |
| **Stil**           | Refined Elegance – clean, reduziert, aber nicht kalt             |
| **Assoziationen**  | Tennisplatz (Grün), Abendhimmel (Navy), Sonnenuntergang (Orange) |
| **Premium-Faktor** | Subtile Texturen (Noise), sanfte Glows, Glass-Morphism           |

### Drei-Säulen-Palette

```
🌲 Deep Forest  (#1B4332)  →  Vertrauen, Stabilität, Natur
🌃 Midnight Navy (#1e3a5f) →  Tiefe, Professionalität, Ernsthaftigkeit
🌅 Sunrise Orange (#FF6B35) →  Energie, Action, Calls-to-Action
```

---

## 2. Farbsystem

### 2.1 CSS Custom Properties (HSL)

Alle Brand-Farben sind als HSL-Variablen definiert, was dunkle/hlle Varianten durch Opazität ermglicht.

```css
:root {
  /* Brand Core */
  --brand-primary: 150 48% 18%; /* Deep Forest #1B4332 */
  --brand-primary-light: 150 45% 35%; /* Forest Mid #2D6A4F */
  --brand-secondary: 217 33% 24%; /* Midnight Navy #1e3a5f */
  --brand-accent: 26 100% 60%; /* Sunrise Orange #FF6B35 */

  /* Surfaces */
  --surface: 0 0% 100%; /* White */
  --surface-elevated: 0 0% 99%; /* Off-white für Karten */

  /* Borders */
  --border-subtle: 150 10% 92%; /* Sehr helles Grün-Grau */

  /* Text */
  --text-primary: 150 20% 10%; /* Fast Schwarz mit Grünstich */
  --text-secondary: 150 10% 40%; /* Gedämpftes Grün-Grau */
}
```

```css
.dark {
  --brand-primary: 150 70% 28%; /* Helleres Grün für Sichtbarkeit */
  --brand-primary-light: 150 60% 40%;
  --brand-secondary: 217 40% 35%;
  --brand-accent: 26 100% 65%;
  --surface: 150 20% 8%; /* Tiefdunkel */
  --surface-elevated: 150 15% 12%; /* Leicht erhht */
  --border-subtle: 150 15% 18%;
  --text-primary: 0 0% 98%; /* Fast Weiß */
  --text-secondary: 150 5% 60%;
}
```

### 2.2 Shadcn/ui Farben (Tailwind)

Mittels `tailwindcss-animate`-Plugin generiert:

```css
--background: 0 0% 100% → dark: 150 20% 8% --foreground: 150 20% 10% → dark: 0 0% 98% --card: 0 0%
  100% → dark: 150 15% 12% --card-foreground: 150 20% 10% → dark: 0 0% 98% --popover: 0 0% 100% →
  dark: 150 15% 12% --primary: 150 48% 18% → dark: 150 70% 28% --secondary: 217 33% 24% → dark: 217
  40% 35% --muted: 150 10% 92% → dark: 150 15% 18% --accent: 26 100% 60% → dark: 26 100% 65%
  --destructive: 0 84% 60% → dark: 0 84% 60% --border: 150 10% 92% → dark: 150 15% 18% --input: 150
  10% 92% → dark: 150 15% 18% --ring: 150 48% 18% → dark: 150 70% 28%;
```

### 2.3 Semantic Colors

```typescript
success:    #22c55e    (Grün, positive Aktionen)
warning:    #f59e0b    (Gelb, neutrale Warnungen)
error:      #ef4444    (Rot, Fehler / gefährliche Aktionen)
info:       #3b82f6    (Blau, Information)

// Mit Light-Varianten für Hintergründe:
successLight: #dcfce7
warningLight: #fef3c7
errorLight:   #fee2e2
infoLight:    #dbeafe
```

### 2.4 Brand Tailwind-Farben (Hex)

In `tailwind.config.ts` zusätzlich als Hex-Farben definiert:

```
brand.primary:   #1B4332
brand.secondary: #1e3a5f
brand.accent:    #FF6B35
```

### 2.5 Role-basierte Farben (Sidebar)

```typescript
superadmin: gradient: from-purple-500 to-purple-700  → bg: purple-50  → text: purple-700
admin:      gradient: from-brand-light to-brand-primary → bg: brand-light/10 → text: brand-light
trainer:    gradient: from-emerald-500 to-emerald-700  → bg: emerald-50 → text: emerald-600
member:     gradient: from-brand-primary to-brand-dark  → bg: brand-light/10 → text: brand-light
```

### 2.6 Primary Scale (Forest Green)

```
50:  #f0fdf4    100: #dcfce7    200: #bbf7d0
300: #86efac    400: #4ade80    500: #22c55e
600: #16a34a    700: #15803d    800: #166534
900: #14532d    950: #0a3d2e
     brand: #1B4332     velvet: #0f2d22
```

### 2.7 Secondary Scale (Midnight Navy)

```
50:  #f0f4f8    100: #d9e2ec    200: #bcccdc
300: #9fb3c8    400: #829ab1    500: #627d98
600: #486581    700: #3e5c76    800: #334e68
900: #1e3a5f    950: #0f1f33
     brand: #1e3a5f     obsidian: #0a1420
```

### 2.8 Accent Scale (Sunrise Orange)

```
50:  #fff7ed    100: #ffedd5    200: #fed7aa
300: #fdba74    400: #fb923c    500: #f97316
600: #ea580c    700: #c2410c    800: #9a3412
900: #7c2d12    950: #4a1a0b
     brand: #FF6B35     ember: #e85a2a
```

### 2.9 Neutrals (Warm Grays)

```
25:  #fefefe    50:  #fafafa    100: #f5f5f6
150: #ebebec    200: #e0e1e3    300: #c7c9cc
400: #a0a3a8    500: #75787f    600: #54585f
700: #3a3f47    800: #252a33    900: #151921
950: #0c0f14
```

---

## 3. Typografie

### 3.1 Font Families

```typescript
sans:    ['"DM Sans"', 'system-ui', 'sans-serif']          → Body-Text, UI
display: ['"Clash Display"', '"DM Sans"', 'system-ui', ...] → Headlines, hero
mono:    ['"JetBrains Mono"', 'Consolas', 'monospace']      → Code, Daten
```

- **Clash Display** via Fontshare CDN (woff2) – Gewichte 400–900, `font-display: swap`
- **DM Sans** – Standardschrift, serifenlos
- **JetBrains Mono** – Monospace für technische Inhalte

### 3.2 Font Sizes

```typescript
// Tailwind Display-Skala (für hero/headlines)
display-1:  3.75rem  (60px)  / 1.1 / 800  → Hero-Titel
display-2:  3rem     (48px)  / 1.2 / 700  → Page-Titel
display-3:  2.25rem  (36px)  / 1.2 / 700  → Section-Titel
display-4:  1.875rem (30px)  / 1.3 / 600  → Card-Titel

hero-xl:    4.5rem   (72px)  / 1.1 / 800  → Große Hero-Überschrift
hero-lg:    3.75rem  (60px)  / 1.15 / 800
hero-md:    3rem     (48px)  / 1.2 / 700

// Standard-Skala (theme.ts)
2xs:  0.625rem  (10px)  → Label, Badge
xs:   0.75rem   (12px)  → Caption, Meta
sm:   0.875rem  (14px)  → Body small, Sidebar
base: 1rem      (16px)  → Body default
lg:   1.125rem  (18px)  → Body large
xl:   1.25rem   (20px)  → Sub-headline
2xl:  1.5rem    (24px)  → Small headline
3xl:  1.875rem  (30px)
4xl:  2.25rem   (36px)
5xl:  3rem      (48px)
6xl:  3.75rem   (60px)
7xl:  4.5rem    (72px)
8xl:  6rem      (96px)
9xl:  8rem      (128px)
```

### 3.3 Font Weights

```typescript
light: 300;
normal: 400;
medium: 500;
semibold: 600;
bold: 700;
extrabold: 800;
black: 900;
```

### 3.4 Line Heights

```typescript
none:    1        → Display-Texte
tight:   1.15     → Hero-Überschriften
snug:    1.25     → Headlines
normal:  1.5      → Body-Text (Standard)
relaxed: 1.625    → Lese-Texte
loose:   1.75     → Kommentare, Zitate
```

### 3.5 Letter Spacing

```typescript
tighter: -0.05em    → Display-Headlines
tight:   -0.025em   → Große Headlines
normal:  0          → Standard
wide:    0.025em    → Hervorgehobener Text
wider:   0.05em     → Labels, Buttons
widest:  0.1em      → Uppercase Labels, Badges
```

### 3.6 Font Feature Settings (Global)

```css
body {
  font-feature-settings:
    'rlig' 1,
    'calt' 1,
    'kern' 1;
  text-rendering: optimizeLegibility;
}
```

- `-webkit-font-smoothing: antialiased` und `-moz-osx-font-smoothing: grayscale` global aktiviert

---

## 4. Abstands-Skala (Spacing)

### 4.1 Theme-Spacing (Custom)

```typescript
18: 4.5rem  (72px)
22: 5.5rem  (88px)
28: 7rem    (112px)
32: 8rem    (128px)
```

### 4.2 Semantic Spacing

```typescript
xs:  0.5rem   (8px)    → Zwischen Icon & Text
sm:  0.75rem  (12px)   → Zwischen zusammengehrigen Elementen
md:  1rem     (16px)   → Standard-Abstand (padding)
lg:  1.5rem   (24px)   → Zwischen Sektionen
xl:  2rem     (32px)   → Große Sektionsabstände
2xl: 3rem     (48px)   → Page-Sektionen
3xl: 4rem     (64px)   → Hero-Bereiche
4xl: 6rem     (96px)   → Große Hero-Bereiche
```

---

## 5. Border Radius

```typescript
none:   0          → Rechteckig
sm:     0.375rem   (6px)  → Inputs, kleine Elemente
md:     0.5rem     (8px)  → Cards, Buttons (Standard)
lg:     0.75rem    (12px) → Große Cards, Modals
xl:     1rem       (16px) → Sheets, Drawer
2xl:    1.5rem     (24px) → Hero-Sektionen, Premium Cards
3xl:    2rem       (32px) → Große Container
4xl:    3rem       (48px) → Maximale Abrundung
full:   9999px             → Pill, Badge, Avatar

// Spezial
bubble: 1.5rem 1.5rem 0 1.5rem  → Chat-Bubble-Form
```

---

## 6. Shadow System

### 6.1 Elevation Shadows

```css
xs:   0 1px 2px 0 rgb(0 0 0 / 0.04)                          → Subtile Elevation
sm:   0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(...) → Cards, Buttons
md:   0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px ...  → Soft (Default)
lg:   0 12px 24px -4px rgb(0 0 0 / 0.1), 0 4px 8px -2px ... → Medium
xl:   0 24px 48px -8px rgb(0 0 0 / 0.12), 0 8px 16px ...    → Strong
2xl:  0 32px 64px -12px rgb(0 0 0 / 0.2)                    → Modal
3xl:  0 48px 80px -16px rgb(0 0 0 / 0.25)                   → Hero
```

### 6.2 Glow Shadows

```css
shadow-glow-primary:
  0 0 60px -12px rgba(27, 67, 50, 0.35),
  0 0 24px -8px rgba(27, 67, 50, 0.25)

shadow-glow-accent:
  0 0 60px -12px rgba(255, 107, 53, 0.35),
  0 0 24px -8px rgba(255, 107, 53, 0.25)

shadow-glow-premium:
  0 0 80px -16px rgba(27, 67, 50, 0.4),
  0 0 40px -12px rgba(27, 67, 50, 0.3),
  0 0 0 1px rgba(255, 255, 255, 0.1) inset
```

### 6.3 Tailwind Shadow Utilities

```typescript
soft:      md            → Standard-Karten
medium:    lg            → Erhhte Karten
strong:    xl            → Modale, Sheets

glow-green-sm:  glow.primary        → Primäre Hover-States
glow-green:     glow.primaryStrong  → Aktive Primärelemente
glow-orange-sm: glow.accent         → Accent Hover
glow-orange:    glow.accentStrong   → Aktive Accent-Elemente

glass:    0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.1)
elegant:  0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.02)
premium:  0 24px 64px -16px rgba(0,0,0,0.15), 0 8px 32px -8px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.1) inset
```

### 6.4 Card Shadows

```typescript
card.default:   0 2px 8px -2px rgb(0 0 0 / 0.06), 0 4px 16px -4px rgb(0 0 0 / 0.04)
card.hover:     0 12px 32px -8px rgb(0 0 0 / 0.1), 0 4px 12px -4px rgb(0 0 0 / 0.06)
card.elevated:  0 24px 48px -12px rgb(0 0 0 / 0.12), 0 8px 24px -8px rgb(0 0 0 / 0.08), 0 0 0 1px rgba(255,255,255,0.05) inset
```

### 6.5 Button Shadows

```typescript
button.default: 0 2px 8px -2px rgba(27, 67, 50, 0.3), 0 1px 2px rgba(0, 0, 0, 0.05)
button.hover:   0 8px 24px -4px rgba(27, 67, 50, 0.4), 0 2px 8px -2px rgba(27, 67, 50, 0.2)
button.active:  0 1px 4px rgba(27, 67, 50, 0.3) inset
```

---

## 7. Gradienten-System

### 7.1 Background Gradients

```css
gradient-primary:
  linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #40916C 100%)

gradient-accent:
  linear-gradient(135deg, #FF6B35 0%, #FF8C5A 50%, #FFAB76 100%)

gradient-warm:
  linear-gradient(135deg, #FF6B35 0%, #40916C 100%)

gradient-hero:
  linear-gradient(160deg, #0A3D2E 0%, #1B4332 40%, #2D6A4F 100%)

gradient-mesh:
  linear-gradient(135deg, #1B4332 → #2D6A4F → #40916C → #52B788 → #74C69D)

gradient-card:
  linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)

gradient-shine:
  linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)
```

### 7.2 Radial Gradients

```css
primaryRadial:
  radial-gradient(ellipse 80% 50% at 50% 0%, #40916C 0%, #1B4332 100%)

accentRadial:
  radial-gradient(circle at 70% 30%, #FFAB76 0%, #FF6B35 100%)
```

### 7.3 Mesh Gradients (Hero Backgrounds)

```css
primaryMesh:
  radial-gradient(at 40% 20%, hsla(150,48%,25%,0.8) 0px, transparent 50%),
  radial-gradient(at 80% 0%, hsla(150,45%,35%,0.6) 0px, transparent 50%),
  radial-gradient(at 0% 50%, hsla(217,33%,20%,0.5) 0px, transparent 50%),
  radial-gradient(at 80% 50%, hsla(150,48%,30%,0.4) 0px, transparent 50%),
  radial-gradient(at 0% 100%, hsla(217,33%,25%,0.6) 0px, transparent 50%),
  radial-gradient(at 80% 100%, hsla(150,45%,35%,0.5) 0px, transparent 50%),
  radial-gradient(at 0% 0%, hsla(150,50%,20%,0.7) 0px, transparent 50%)

aurora:
  radial-gradient(ellipse 60% 40% at 10% 20%, rgba(64,145,108,0.3) 0%, transparent 50%),
  radial-gradient(ellipse 50% 50% at 90% 80%, rgba(255,107,53,0.15) 0%, transparent 50%),
  radial-gradient(ellipse 80% 30% at 50% 90%, rgba(30,58,95,0.2) 0%, transparent 40%)
```

### 7.4 Text Gradients

```css
text-gradient-primary:
  linear-gradient(135deg, #1B4332 0%, #40916C 100%)

text-gradient-accent:
  linear-gradient(135deg, #FF6B35 0%, #FFAB76 100%)

text-gradient-warm:
  linear-gradient(135deg, #FF6B35 0%, #40916C 100%)
```

### 7.5 Glass Gradients

```css
glass:     linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)
glassDark: linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 100%)
```

---

## 8. Glass-Morphism-System

Vier Helligkeitsstufen, deklariert als Tailwind-Utilities:

```css
/* Light Glass – für subtile Trennungen */
.glass {
  background: hsl(var(--surface) / 0.8);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid hsl(var(--border-subtle) / 0.5);
}

/* Strong Glass – für Karten, Modale */
.glass-strong {
  background: hsl(var(--surface) / 0.9);
  backdrop-filter: blur(40px) saturate(200%);
  border: 1px solid hsl(var(--border-subtle) / 0.6);
  box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.08);
}

/* Dark Glass – für dunkle Overlays */
.glass-dark {
  background: hsl(var(--brand-primary) / 0.4);
  backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid hsl(0 0% 100% / 0.1);
}

/* Dark Strong Glass – für Premium-Dark-Elemente */
.glass-dark-strong {
  background: hsl(var(--brand-primary) / 0.6);
  backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid hsl(0 0% 100% / 0.15);
  box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.3);
}
```

---

## 9. Animation & Motion

### 9.1 Timing Functions (Easings)

```css
--ease-smooth:    cubic-bezier(0.4, 0, 0.2, 1);       → Standard-UI
--ease-bounce:    cubic-bezier(0.34, 1.56, 0.64, 1);  → Scale-in, Sprünge
--ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);       → Entry-Animationen
--ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1);  → Federnd (Alias)
```

### 9.2 Transition Durations

```css
--transition-fast:
  150ms → Hover, Active,
  Tap --transition-base: 250ms → Standard-Übergänge --transition-slow: 400ms → Page-Transitions,
  Reveals tailwind: duration-400, duration-500;
```

### 9.3 Transition Timing Functions (Tailwind)

```typescript
spring: cubic - bezier(0.34, 1.56, 0.64, 1); // Federnd
gentle: cubic - bezier(0.25, 0.46, 0.45, 0.94); // Sanft
```

### 9.4 Keyframe-Animationen (16 Stück)

| Name             | Dauer | Verwendung                           |
| ---------------- | ----- | ------------------------------------ |
| `float`          | 6s    | Schwebende Elemente (Deko)           |
| `float-slow`     | 8s    | Langsam schwebend                    |
| `pulse-glow`     | 3s    | Pulsierender Glow (CTA, Premium)     |
| `shimmer`        | 2.5s  | Skeleton Loading                     |
| `fade-in-up`     | 0.6s  | Standard Entry (mit Scale .98)       |
| `fade-in`        | 0.5s  | Einfaches Einblenden                 |
| `scale-in`       | 0.4s  | Cards, Modale (mit Bounce)           |
| `slide-in-right` | 0.5s  | Seitenpanel, Drawer                  |
| `slide-in-left`  | 0.5s  | Sidebar-Entry                        |
| `slide-down`     | 0.25s | Akkordeon, Dropdown (mit max-height) |
| `gradient-shift` | 8s    | Hintergrund-Gradient-Animation       |
| `aurora`         | 15s   | Aurora-Borealis-Effekt (Hero)        |
| `marquee`        | 30s   | Lauftext-Banner                      |
| `border-glow`    | 3s    | Pulsierender Rahmen                  |
| `ripple`         | 0.6s  | Ripple-Effekt auf Klick              |
| `count-up`       | 0.5s  | Zahl-Animation                       |

### 9.5 Entry-Animation-Utilities

```css
.animate-in            → fade-in-up 0.6s
.animate-in-delay-1..5 → gestaffelt (100–500ms)
.reveal                → Scroll-Triggered (opacity 0 → 1, translateY 30px → 0)
.reveal-delay-1..4     → Gestaffeltes Reveal
```

### 9.6 Hover-Effekte

```css
.hover-lift:   translateY(-4px) + box-shadow (250ms ease-smooth)
.hover-glow:   box-shadow 0 0 40px -8px hsl(var(--brand-primary) / 0.25)
.tap-scale:    scale(0.97) on :active (150ms ease-smooth)
```

### 9.7 Grafische Effekte

```css
.noise::before:  SVG-Noise-Textur (opacity: 0.03) für subtile Tiefe

.gradient-border::before:
  Gradient-Border (1px) mit `mask-composite: exclude`
  Verlauf: brand-primary → brand-accent

.bg-grid:
  60px-Gitter aus border-subtle / 0.3

.overlay-gradient-t:  Transparenter Verlauf nach oben
.overlay-gradient-b:  Transparenter Verlauf nach unten
```

### 9.8 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Utility-Klassen

### 10.1 Brand-Text-Farben

```css
.text-brand-primary    → hsl(var(--brand-primary))
.text-brand-light      → hsl(var(--brand-primary-light))
.text-brand-secondary  → hsl(var(--brand-secondary))
.text-brand-accent     → hsl(var(--brand-accent))
```

### 10.2 Brand-Hintergründe

```css
.bg-brand-primary      → hsl(var(--brand-primary))
.bg-brand-light        → hsl(var(--brand-primary-light))
.bg-brand-secondary    → hsl(var(--brand-secondary))
.bg-brand-accent       → hsl(var(--brand-accent))
.bg-surface-dark       → hsl(var(--surface-elevated))
```

### 10.3 Brand-Hintergrund-Opazitäten

```css
.bg-brand-primary/5    → 5% Opazität
.bg-brand-primary/10   → 10%
.bg-brand-primary/20   → 20%
.bg-brand-light/5      → 5%
.bg-brand-light/10     → 10%
.bg-brand-light/20     → 20%
.bg-brand-accent/10    → 10%
.bg-brand-accent/20    → 20%
```

### 10.4 Brand-Borders

```css
.border-brand-primary  → hsl(var(--brand-primary))
.border-brand-light    → hsl(var(--brand-primary-light))
.border-brand-accent   → hsl(var(--brand-accent))
```

### 10.5 Skeleton Loading

```css
.skeleton:
  Gradient-Shimmer (border-subtle → 40% → border-subtle)
  background-size: 200% 100%
  animation: shimmer 2s ease-in-out infinite
  border-radius: 0.5rem
```

### 10.6 iOS Safe Area Utilities

```css
.safe-area-pt  → padding-top: env(safe-area-inset-top)
.safe-area-pb  → padding-bottom: env(safe-area-inset-bottom)
.safe-area-pl  → padding-left: env(safe-area-inset-left)
.safe-area-pr  → padding-right: env(safe-area-inset-right)
.safe-area-mt  → margin-top: env(safe-area-inset-top)
.safe-area-mb  → margin-bottom: env(safe-area-inset-bottom)
```

### 10.7 Focus-visible

```css
:focus-visible {
  outline: none;
  ring: 2px solid hsl(var(--ring));
  ring-offset: 2px;
  ring-offset: background;
}
```

### 10.8 Selection

```css
::selection {
  background: hsl(var(--brand-primary) / 0.2);
  color: hsl(var(--brand-primary));
}
```

---

## 11. Responsive Breakpoints

```typescript
sm:  640px   → Mobile Landscape
md:  768px   → Tablet
lg:  1024px  → Desktop
xl:  1280px  → Desktop Wide
2xl: 1536px  → Desktop Ultra-wide
```

### Layout-Strategie

| Gerät                 | Sidebar            | Bottom Nav                        | Content        |
| --------------------- | ------------------ | --------------------------------- | -------------- |
| **Mobile (< 768px)**  | Overlay (Slide-in) | Persistent (Admin: + Menu Button) | Full width     |
| **Desktop (≥ 768px)** | Permanent (w-64)   | Versteckt (`md:hidden`)           | `ml-64` offset |

- Member & Trainer: Bottom Nav **immer sichtbar** (`persistent`), da sie kein Hamburger-Menü haben
- Admin & Superadmin: Bottom Nav nur mobil + Hamburger-Button für Sidebar

---

## 12. Z-Index-Skala

```typescript
dropdown: 1000;
sticky: 1020;
fixed: 1030;
modalBackdrop: 1040;
modal: 1050;
popover: 1060;
tooltip: 1070;
toast: 1080;
```

Sidebar-Overlay auf Mobile nutzt `z-50` (Tailwind) + `shadow-2xl shadow-black/10`.

---

## 13. Design Audit Scorecard

Bewertung nach 10 Design-Dimensionen (0–10):

| #   | Dimension                 |  Score   | Kritik                                                                                                                                                      |
| --- | ------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Farbkonsistenz**        | **8/10** | HSL-Palette exzellent. `brand.primary` als Hex in tailwind.config inkonsistent zu HSL-Nutzung.                                                              |
| 2   | **Typografie-Hierarchie** | **7/10** | Clash+DM Sans durchdacht. Sidebar nutzt keine Display-Font, obwohl definiert.                                                                               |
| 3   | **Spacing-Rhythmus**      | **6/10** | Custom Spacing vorhanden (18/22/28/32). Sidebar wildes Mix aus `px-3`, `px-4`, `py-2.5`, `py-6` – kein konsistenter Raster.                                 |
| 4   | **Component-Konsistenz**  | **5/10** | Zwei verschiedene Sidebar-Komponenten (sidebar.tsx + admin-sidebar.tsx dead code). Zwei Card-Konzepte. NavigationCategory vs. AdminSection unterschiedlich. |
| 5   | **Responsives Verhalten** | **7/10** | Saubere Desktop/Mobile-Trennung. Admin-Overlay auf Mobile zeigt volle Desktop-Sidebar – zu dicht.                                                           |
| 6   | **Dark Mode**             | **8/10** | Vollständiges Dark-Theme, `prefers-color-scheme` + `.dark`-Klasse. Alle CSS-Variablen zweisprachig.                                                         |
| 7   | **Animation**             | **7/10** | 16 Keyframes, Easing-Variablen, Hover-Lift/Glow/Tap. Ungenutzt: aurora, marquee, ripple, count-up.                                                          |
| 8   | **Accessibility**         | **6/10** | SkipToContent, aria-labels, sr-only. Keine Tastaturnavigation-Prüfung.                                                                                      |
| 9   | **Information Density**   | **5/10** | Admin-Sidebar: 6 Sektionen, 16 Links + Club-Switcher + Logo + Badge = überladen.                                                                            |
| 10  | **Polish**                | **7/10** | Micro-Interactions (hover-lift, glass, active indicator). Dead-Code-Komponenten mit anderem Design.                                                         |

**Gesamtscore: 66 / 100**

---

## 14. Empfehlungen & Optimierungen

### 🔴 Kritisch

1. **Dead Code entfernen** – `admin-sidebar.tsx` und `trainer-sidebar.tsx` sind tote Komponenten mit anderem visuellen Design. Verwirrend für Developer.
2. **Sidebar-Links korrigieren** – `/admin/audit-logs` existiert nicht (404). KI-Matchmaking-Link fehlt in aktiver Sidebar, obwohl in toter vorhanden.
3. **Buchungs-Dopplung** – `/bookings` (Member-Perspektive) als Admin-Link ist falscher Scope. `/admin/courts` reicht als Single Source of Truth.

### 🟡 Mittel

4. **Spacing in Sidebar vereinheitlichen** – Aktuell Mix aus `px-3`, `px-4`, `py-2.5`, `py-6`. Auf 4px/8px-Raster standardisieren (`px-3`, `py-2`).
5. **Glass-Varianten reduzieren** – Von 4 auf 2 (`.glass` + `.glass-strong`). `.glass-dark` und `.glass-dark-strong` werden kaum verwendet.
6. **Ungenutzte Animationen aufräumen** – `aurora`, `marquee`, `border-glow`, `ripple`, `count-up` sind definiert aber nirgendwo in Verwendung.

### 🟢 Nice-to-have

7. **Spacing-Tokens in theme.ts mit dem tatsächlichen CSS-Abgleich bringen** – `spacing.xs = 0.5rem` wird in der Sidebar kaum verwendet.
8. **Z-Index-Tokens in globals.css als CSS-Variablen definieren** – Aktuell nur als TypeScript-Konstanten in theme.ts.
9. **Design-Preview-Seite generieren** – Self-contained HTML-Seite, die alle Tokens visualisiert (Farben, Typografie, Schatten, Glass-Effekte).

---

## Anhang: Datei-Referenzen

| Token-Typ             | Datei                                       | Zeilen                      |
| --------------------- | ------------------------------------------- | --------------------------- |
| CSS Custom Properties | `app/globals.css`                           | 12–33 (Light), 35–44 (Dark) |
| Tailwind Config       | `tailwind.config.ts`                        | Gesamte Datei               |
| TypeScript Tokens     | `styles/theme.ts`                           | Gesamte Datei (9 Exporte)   |
| Glass Utilities       | `app/globals.css`                           | 140–168                     |
| Keyframes             | `app/globals.css`                           | 168–270 (16 Keyframes)      |
| Animation Classes     | `app/globals.css`                           | 272–295                     |
| Utility Classes       | `app/globals.css`                           | 48–168                      |
| Role Colors (Sidebar) | `components/layout/sidebar.tsx`             | 31–52                       |
| Mobile Nav            | `components/layout/mobile-bottom-nav.tsx`   | Gesamte Datei               |
| Navigation Category   | `components/layout/navigation-category.tsx` | Gesamte Datei               |

---

> **Maintainer-Hinweis:** Bei Änderungen an `styles/theme.ts` oder `tailwind.config.ts` bitte immer auch `app/globals.css` prüfen, ob die CSS-Variablen konsistent bleiben. Neue Farben zuerst als HSL-Variable in globals.css definieren, dann im Tailwind-Config referenzieren.
