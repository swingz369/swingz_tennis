# SwingZ Design System – Visual Guidelines

## Color Palette

### Brand Colors

- **Primary (Forest Green):** `#1B4332` → CSS var `--brand-primary`
- **Secondary (Navy):** `#1e3a5f` → CSS var `--brand-secondary`
- **Accent (Orange):** `#FF6B35` → CSS var `--brand-accent`

### Functional Colors

- **Success:** `#22c55e` (green-500) - used for confirmed, online status
- **Warning:** `#eab308` (yellow-500) - used for pending, caution
- **Error:** `#ef4444` (red-500) - used for errors, cancellations
- **Info:** `#3b82f6` (blue-500) - used for informational messages

### Neutral Grays

- **Gray 50:** `#f9fafb` (backgrounds, light surfaces)
- **Gray 100:** `#f3f4f6` (borders, dividers)
- **Gray 200:** `#e5e7eb` (borders, separators)
- **Gray 300:** `#d1d5db` (borders, disabled)
- **Gray 400:** `#9ca3af` (text-secondary)
- **Gray 500:** `#6b7280` (text-muted)
- **Gray 600:** `#4b5563` (text-default in light mode)
- **Gray 700:** `#374151` (headings in light mode)
- **Gray 800:** `#1f2937` (headings, dark mode text)
- **Gray 900:** `#111827` (headings, high contrast)

### Dark Mode Adjustments

All brand colors are lightened by ~20-30% for better contrast on dark backgrounds:

- Primary: `hsl(150, 100%, 30%)` instead of 19%
- Secondary: `hsl(217, 33%, 40%)` instead of 24%
- Accent: `hsl(26, 100%, 75%)` instead of 68%

## Typography

### Font Families

- **Primary:** Inter (sans-serif) – body text, UI elements
- **Display:** Playfair Display (serif) – headings, hero sections

### Font Sizes (Tailwind classes)

- **Hero/Display:** `text-hero-lg` (5rem), `text-hero-md` (3.5rem) – landing pages only
- **H1:** `text-4xl` (2.25rem) – page titles
- **H2:** `text-3xl` (1.875rem) – section headings
- **H3:** `text-2xl` (1.5rem) – card headings
- **H4:** `text-xl` (1.25rem) – sub-section headings
- **Body:** `text-base` (1rem) – default
- **Small:** `text-sm` (0.875rem) – secondary text
- **Tiny:** `text-xs` (0.75rem) – captions, badges

### Font Weights

- **Regular:** `font-normal` (400)
- **Medium:** `font-medium` (500)
- **Semibold:** `font-semibold` (600)
- **Bold:** `font-bold` (700)

## Spacing

### Base Unit

- **4px** base unit. All spacing uses multiples of 4: 0.25rem (4px), 0.5rem (8px), 0.75rem (12px), 1rem (16px), etc.

### Common Spacing Values

- **Component padding:** `p-4`, `p-6`, `p-8`
- **Grid gaps:** `gap-4`, `gap-6`, `gap-8`
- **Margins between sections:** `space-y-6`, `space-y-8`
- **Element spacing:** `gap-2`, `gap-3` (tight), `gap-4` (comfortable)

## Border Radius

### Standard Radii

- **Small:** `rounded-md` (0.375rem) – inputs, small cards
- **Medium:** `rounded-lg` (0.5rem) – buttons, standard cards
- **Large:** `rounded-xl` (0.75rem) – input fields, feature cards
- **Extra Large:** `rounded-2xl` (1rem) – hero cards, feature boxes, professional card variants
- **Full/Pill:** `rounded-full` – buttons, badges, avatars, tags

Apply consistently:

- Buttons → `rounded-full` (pill shape)
- Inputs → `rounded-xl`
- Cards → `rounded-2xl` (elevated), `rounded-lg` (standard)
- Avatars → `rounded-full`
- Badges → `rounded-full`

## Shadows

### Elevation Levels

- **None:** `shadow-none` – flat design
- **Level 1:** `shadow-sm` – subtle elevation (cards, inputs)
- **Level 2:** `shadow-md` – medium elevation (cards on hover, modals)
- **Level 3:** `shadow-lg` – high elevation (dropdowns, popovers)
- **Level 4:** `shadow-xl` – very high elevation (dialogs, sheets)
- **Brand soft:** `shadow-soft` – custom soft shadow for cards (defined in Tailwind config)

### Shadow-soft CSS

```css
.shadow-soft {
  box-shadow: 0 4px 20px -2px rgba(27, 67, 50, 0.1);
}
```

### Hover States

- Cards: `hover:shadow-lg hover:-translate-y-1` (subtle lift)
- Buttons: `hover:shadow-md` (enhanced depth)
- Interactive rows: `hover:bg-gray-50 dark:hover:bg-gray-800`

## Transitions

### Duration

- **Fast:** `duration-100` (100ms) – micro-interactions
- **Standard:** `duration-200` (200ms) – hovers, state changes
- **Medium:** `duration-300` (300ms) – page transitions, modal animations
- **Slow:** `duration-500` (500ms) – page loads, skeleton fades

### Easing

- **Default:** `ease-out` – natural deceleration
- **Smooth:** `ease-in-out` – symmetrical acceleration/deceleration

## Layout

### Grid System

- **12-column grid** for desktop
- **4-column grid** for tablet
- **1-column stack** for mobile

### Container Widths

- **Narrow:** `max-w-md` (28rem) – forms, modals
- **Medium:** `max-w-lg` (32rem) – cards, dialogs
- **Standard:** `max-w-4xl` (56rem) – content pages
- **Full:** `max-w-7xl` (80rem) – dashboard, tables

### Breakpoints

- **sm:** 640px (mobile landscape)
- **md:** 768px (tablet)
- **lg:** 1024px (desktop)
- **xl:** 1280px (large screens)

## Component Variants

### Card

- **default:** Standard card with border, light shadow
- **elevated:** Stronger shadow, slight lift on hover
- **bordered:** Prominent border, minimal shadow
- **flat:** No border, gray background
- **gradient:** Subtle gradient background

### Button

- **default/primary:** Gradient green (brand primary) – primary actions
- **secondary:** Navy blue – secondary actions
- **accent:** Orange – highlight actions (CTAs)
- **outline:** Border only, transparent bg – tertiary actions
- **ghost:** No bg/border, colored text – subtle actions
- **destructive:** Red – delete, cancel, dangerous actions
- **link:** Underlined text – navigation links

### Badge

- **default:** Green badge – success, active status
- **secondary:** Navy – informational
- **accent:** Orange – warning, attention
- **success:** Green light bg – positive
- **warning:** Yellow light bg – caution
- **error:** Red light bg – error, cancelled
- **info:** Blue light bg – info
- **outline:** Gray border – neutral

## Iconography

### Icon Library

- lucide-react (v0.477.12)
- Consistent stroke width, rounded corners, minimal design

### Icon Sizes

- **xs:** 14px (h-3 w-3 to h-4 w-4)
- **sm:** 16px (h-4 w-4)
- **md:** 20px (h-5 w-5) – default button icon
- **lg:** 24px (h-6 w-6)
- **xl:** 32px (h-8 w-8)

### Icon Colors

- Match text color by default (inherit)
- Use semantic colors for status: green (success), red (error), yellow (warning), blue (info)

## Accessibility Standards

### Focus States

- All interactive elements must have visible focus ring
- Focus ring color: `ring-ring` (uses CSS var, matches brand primary)
- Focus offset: `ring-offset-2` (background separation)

### Color Contrast

- Minimum AA compliance: 4.5:1 for normal text, 3:1 for large text
- Brand colors on white: Primary green passes AA, orange needs careful use (avoid long text)
- Dark mode: Lightened brand colors improve contrast

### Touch Targets

- Minimum 44×44px (h-11 w-11 default for buttons)
- Tap targets extended through padding, not just icon size

### Reduced Motion

- Respect `prefers-reduced-motion` media query
- Animations disabled or reduced to essential only

## Icon & Badge Status Reference

| Status          | Badge Variant     | Icon Color               |
| --------------- | ----------------- | ------------------------ |
| Confirmed       | `success`         | `text-green-600`         |
| Pending         | `warning`         | `text-yellow-600`        |
| Cancelled       | `error`           | `text-red-600`           |
| No-Show         | `error`           | `text-gray-600`          |
| Active (member) | `default`         | `text-brand-primary-600` |
| Inactive        | `secondary`       | `text-gray-500`          |
| Online          | `success` (dot)   | `bg-green-500`           |
| Offline         | `secondary` (dot) | `bg-gray-400`            |
| Busy            | `error` (dot)     | `bg-red-500`             |

## Image Guidelines

### Avatar Images

- Round crop (`rounded-full`)
- 1:1 aspect ratio
- Size variants: xs(24px), sm(32px), md(40px), lg(48px), xl(64px)
- Fallback: Gradient background with initials

### Photo Galleries (future)

- Consistent aspect ratios (4:3 for event photos, 1:1 for profiles)
- Overlap or grid layout for multiple images
- Hover: subtle zoom (scale-105) with smooth transition

## Animation Guide

### Micro-interactions

- **Hover lift:** Cards: `hover:-translate-y-1` (4px up)
- **Scale on press:** Buttons: `active:scale-[0.98]` (2% shrink)
- **Spin loader:** 1s linear infinite cycle, spinner SVG with 40% opacity track
- **Fade in:** Page sections: `animate-fade-in-up` (opacity + Y translation)

### Page Transitions (future)

- Use fade-in-up for new page content
- Duration: 300ms ease-out
- Stagger children with 50-100ms delay per element

## Do's and Don'ts

### ✅ Do

- Use CSS variables (e.g., `bg-primary`, `text-foreground`) for themeable colors
- Prefer `rounded-full` for buttons and badges
- Maintain 16px minimum spacing between elements
- Use semantic color names (`success`, `warning`, `error`) over generic ones
- Include `aria-label` on icon-only buttons

### ❌ Don't

- Use arbitrary values like `h-[27px]` – pick existing size scale
- Mix brand colors with arbitrary hex codes – use variables
- Hardcode text colors without considering dark mode
- Forget focus states – all interactive elements must be keyboard accessible
- Use `text-xs` for body text – minimum `text-sm` for readability

## CSS Variables Reference

Define once in `globals.css` and reference in Tailwind via:

```css
.bg-brand-primary {
  background-color: hsl(var(--brand-primary));
}
.text-brand-primary {
  color: hsl(var(--brand-primary));
}
```

Available brand variables:

- `--brand-primary`
- `--brand-primary-foreground`
- `--brand-secondary`
- `--brand-secondary-foreground`
- `--brand-accent`
- `--brand-accent-foreground`

---

_Last updated: Week 2 visual consistency pass (autonomous)_
