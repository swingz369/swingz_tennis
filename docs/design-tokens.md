# 🎨 SwingZ Design Tokens & Utility Classes

## Übersicht

SwingZ nutzt ein semantisches Design-Token-System basierend auf CSS Custom Properties (HSL-Werten) und Tailwind-Utility-Klassen. **Keine Hardcoded-Hex-Farben verwenden** – immer die unten dokumentierten Utility-Klassen oder CSS-Variablen nutzen.

---

## CSS Custom Properties (`:root` / `.dark`)

| Variable                | Light Mode    | Dark Mode     | Beschreibung                   |
| ----------------------- | ------------- | ------------- | ------------------------------ |
| `--brand-primary`       | `150 48% 18%` | `150 70% 28%` | Haupt-Markenfarbe (Dunkelgrün) |
| `--brand-primary-light` | `150 45% 35%` | `150 60% 40%` | Helle Markenfarbe (Grün)       |
| `--brand-secondary`     | `217 33% 24%` | `217 40% 35%` | Sekundärfarbe (Blau)           |
| `--brand-accent`        | `26 100% 60%` | `26 100% 65%` | Akzentfarbe (Orange)           |
| `--surface`             | `0 0% 100%`   | `150 20% 8%`  | Oberflächen-Hintergrund        |
| `--surface-elevated`    | `0 0% 99%`    | `150 15% 12%` | Erhöhte Oberfläche             |
| `--border-subtle`       | `150 10% 92%` | `150 15% 18%` | Subtile Border-Farbe           |
| `--text-primary`        | `150 20% 10%` | `0 0% 98%`    | Primäre Textfarbe              |
| `--text-secondary`      | `150 10% 40%` | `150 5% 60%`  | Sekundäre Textfarbe            |

Verwendung in Inline-Styles:

```tsx
style={{ background: 'hsl(var(--brand-primary) / 0.1)' }}
style={{ color: 'hsl(var(--brand-primary-light))' }}
```

---

## Text-Farben

| Utility-Klasse         | Verwendung                   |
| ---------------------- | ---------------------------- |
| `text-brand-primary`   | Primärer Markentext          |
| `text-brand-light`     | Heller Markentext (Grün)     |
| `text-brand-secondary` | Sekundärer Markentext (Blau) |
| `text-brand-accent`    | Akzent-Text (Orange)         |

**Vorher (❌):** `text-[#40916C]`
**Nachher (✅):** `text-brand-light`

---

## Hintergrund-Farben

| Utility-Klasse       | Opazität                |
| -------------------- | ----------------------- |
| `bg-brand-primary`   | 100%                    |
| `bg-brand-light`     | 100%                    |
| `bg-brand-secondary` | 100%                    |
| `bg-brand-accent`    | 100%                    |
| `bg-surface-dark`    | 100% (Surface Elevated) |

### Opazitäts-Varianten

| Utility-Klasse          | Opazität |
| ----------------------- | -------- |
| `bg-brand-primary/5`    | 5%       |
| `bg-brand-primary/10`   | 10%      |
| `bg-brand-primary/20`   | 20%      |
| `bg-brand-primary/30`   | 30%      |
| `bg-brand-primary/50`   | 50%      |
| `bg-brand-light/5`      | 5%       |
| `bg-brand-light/10`     | 10%      |
| `bg-brand-light/20`     | 20%      |
| `bg-brand-accent/10`    | 10%      |
| `bg-brand-accent/20`    | 20%      |
| `bg-brand-secondary/10` | 10%      |

### Hover-Varianten

| Utility-Klasse            | Verhalten               |
| ------------------------- | ----------------------- |
| `hover:bg-brand-light/80` | 80% Opazität beim Hover |
| `hover:bg-brand-light/90` | 90% Opazität beim Hover |

**Vorher (❌):** `bg-[#40916C]/10`, `hover:bg-[#2d6a4f]`
**Nachher (✅):** `bg-brand-light/10`, `hover:bg-brand-light/80`

---

## Border-Farben

| Utility-Klasse         | Verwendung             |
| ---------------------- | ---------------------- |
| `border-brand-primary` | Primäre Border         |
| `border-brand-light`   | Helle grüne Border     |
| `border-brand-accent`  | Akzent-Border (Orange) |

**Vorher (❌):** `border-[#40916C]/20`
**Nachher (✅):** `border-brand-light/20`

---

## Focus-Ring-Farben

| Utility-Klasse       | Verwendung                              |
| -------------------- | --------------------------------------- |
| `ring-brand-light`   | Heller grüner Fokusring (50% Opazität)  |
| `ring-brand-primary` | Dunkler grüner Fokusring (50% Opazität) |
| `ring-brand-accent`  | Oranger Fokusring (50% Opazität)        |

**Vorher (❌):** `focus:ring-[#40916C]/50`
**Nachher (✅):** `focus:ring-brand-light`

---

## Gradienten

| Utility-Klasse          | Beschreibung                                               |
| ----------------------- | ---------------------------------------------------------- |
| `bg-gradient-primary`   | Grün-Gradient (`from-brand-primary to-brand-light`, 135°)  |
| `bg-gradient-accent`    | Orange-Gradient (`from-brand-accent to-orange-400`, 135°)  |
| `text-gradient-primary` | Text-Gradient Grün (mit `bg-clip-text text-transparent`)   |
| `text-gradient-accent`  | Text-Gradient Orange (mit `bg-clip-text text-transparent`) |

**Wichtig:** Gradient-Utilities ersetzen die komplette `bg-gradient-to-* from-* to-*` Kette. Nicht kombinieren!

**Vorher (❌):** `bg-gradient-to-r from-[#1B4332] to-[#2D6A4F]`
**Nachher (✅):** `bg-gradient-primary`

**Vorher (❌):** `bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A]`
**Nachher (✅):** `bg-gradient-accent`

### Manuelle Gradienten (wenn nötig)

Falls ein Gradient nicht durch die Utilities abgedeckt wird, mit CSS-Variablen:

```tsx
className = 'bg-gradient-to-br from-brand-light to-brand-primary';
className = 'bg-gradient-to-r from-brand-primary via-brand-primary/80 to-brand-light';
```

---

## Effekte

| Utility-Klasse        | Beschreibung                                           |
| --------------------- | ------------------------------------------------------ |
| `glass`               | Glas-Effekt (Light Mode: 80% Surface + 24px Blur)      |
| `glass-dark`          | Glas-Effekt (Dark Mode: 40% Brand Primary + 24px Blur) |
| `gradient-border`     | 1px Gradient-Border um das Element                     |
| `shadow-glow-primary` | Grüner Glow-Shadow                                     |
| `shadow-glow-accent`  | Oranger Glow-Shadow                                    |

---

## Animationen

| Klasse                        | Dauer | Beschreibung                                   |
| ----------------------------- | ----- | ---------------------------------------------- |
| `animate-float`               | 6s    | Sanftes Auf-/Ab-Schweben mit leichter Rotation |
| `animate-float-slow`          | 8s    | Langsames vertikales Schweben                  |
| `animate-aurora`              | 15s   | Aurora-Blob-Bewegung (dekorativ)               |
| `animate-pulse-glow`          | 3s    | Pulsierender Glow-Effekt                       |
| `animate-shimmer`             | 2.5s  | Shimmer/Skeleton-Loading                       |
| `animate-gradient`            | 8s    | Langsamer Gradient-Shift                       |
| `animate-in`                  | 0.6s  | Fade-in-up Entrance                            |
| `animate-in-delay-1` ... `-5` | —     | Verzögerte Entrance-Animationen                |
| `hover-lift`                  | 250ms | Hover: translateY(-4px) + Shadow               |

### Reduzierte Bewegung

Alle Animationen werden bei `prefers-reduced-motion: reduce` auf 0.01ms reduziert.

---

## Accessibility-Utilities

| Utility-Klasse | Beschreibung                 |
| -------------- | ---------------------------- |
| `safe-area-pt` | iOS Safe Area Top Padding    |
| `safe-area-pb` | iOS Safe Area Bottom Padding |
| `safe-area-pl` | iOS Safe Area Left Padding   |
| `safe-area-pr` | iOS Safe Area Right Padding  |
| `safe-area-mt` | iOS Safe Area Top Margin     |
| `safe-area-mb` | iOS Safe Area Bottom Margin  |

Der `body` hat automatisch Safe-Area-Insets.

---

## Touch-Target-Größen

Für mobile Interaktivität immer **mindestens 44x44px** Touch-Targets verwenden:

```tsx
// ✅ Gut
className = 'h-12 w-12'; // 48px
className = 'min-h-[48px] px-6 py-3.5';

// ❌ Schlecht
className = 'h-6 w-6'; // 24px — zu klein für Touch
```

---

## Responsive-Breakpoints (Tailwind Default)

| Prefix | Breite   | Gerätetyp     |
| ------ | -------- | ------------- |
| (kein) | < 640px  | Mobile        |
| `sm:`  | ≥ 640px  | Large Mobile  |
| `md:`  | ≥ 768px  | Tablet        |
| `lg:`  | ≥ 1024px | Desktop       |
| `xl:`  | ≥ 1280px | Large Desktop |
| `2xl:` | ≥ 1536px | Extra Large   |

### Mobile-First-Pattern

```tsx
// ✅ Mobile-First (richtig)
<div className="py-16 sm:py-24 lg:py-32">
  <h1 className="text-4xl sm:text-5xl lg:text-7xl">

// ❌ Desktop-First (vermeiden)
<div className="max-sm:py-16 py-32">
```

---

## Dark Mode

Alle Brand-Utility-Klassen unterstützen Dark Mode automatisch (über CSS-Variablen). Zusätzliche Dark-Mode-spezifische Klassen:

```tsx
// Für Tailwind-Farben (gray, white, etc.)
className = 'text-gray-900 dark:text-white';
className = 'bg-white dark:bg-gray-950';

// Brand-Utilities brauchen KEIN dark:-Prefix
className = 'text-brand-light'; // Funktioniert in Light + Dark
className = 'bg-gradient-primary'; // Funktioniert in Light + Dark
```

---

## Migrations-Checkliste

Beim Refactoring alter Komponenten:

- [ ] `text-[#40916C]` → `text-brand-light`
- [ ] `text-[#1B4332]` → `text-brand-primary`
- [ ] `text-[#FF6B35]` → `text-brand-accent`
- [ ] `bg-[#40916C]/10` → `bg-brand-light/10`
- [ ] `bg-[#0f2d22]` → `dark:bg-surface-dark`
- [ ] `from-[#1B4332] to-[#2D6A4F]` → `bg-gradient-primary`
- [ ] `from-[#FF6B35] to-[#FF8C5A]` → `bg-gradient-accent`
- [ ] `hover:bg-[#2d6a4f]` → `hover:bg-brand-light/80`
- [ ] `text-[9px]` / `text-[10px]` → `text-[11px]` (außer Kalender-Grids)
- [ ] Keine doppelten Gradient-Klassen (`bg-gradient-to-br bg-gradient-primary` → `bg-gradient-primary`)
- [ ] Alle Buttons mindestens `min-h-[48px]` auf Mobile
- [ ] `rgba(64,145,108,0.3)` → `hsl(var(--brand-primary-light) / 0.3)`
