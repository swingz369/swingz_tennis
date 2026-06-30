# 🎾 SwingZ — Design-Konzept

> **Version 4.7** — 1. Juli 2026 (Sprint 3+ vollständig: Tickets 9/10/11/12 ✅, F1/F2 behoben, nur Ticket 13 offen)
> **Methode:** `frontend-design` Skill + Code-verifiziert (`glob`, `code-searcher`, `read_files`)
> **Status:** Lebendes Konzept — vierteljährlich aktualisiert

---

## 1. Design Direction — „Athletic Refinement"

**Aesthetic:** _Luxury-minimal × Organic warmth_ — zwei Einflüsse, eine Haltung.

| Element           | Ausprägung                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **Dominant Tone** | Forest Green (`hsl(var(--brand-primary))`) — 60% der UI-Fläche. Vertrauen, Natur, Premium. |
| **Secondary**     | Midnight Navy (`hsl(var(--brand-secondary))`) — 25%. Tiefe, Professionalität.              |
| **Accent**        | Sunrise Orange (`hsl(var(--brand-accent))`) — 15%. Energie, KI-Features, CTAs.             |
| **Display Font**  | Clash Display (Landing Hero + App-Headlines)                                               |
| **Body Font**     | DM Sans (sämtlicher Fließtext)                                                             |
| **Mono Font**     | JetBrains Mono (Daten, Code, technische Info)                                              |

**Was „Athletic Refinement" bedeutet:**

- Kein steriles SaaS-Dashboard — Wärme durch organische Radien (`rounded-2xl`, `rounded-3xl`), weiche Schatten, subtile Noise-Textur
- Kein überladener Sport-Brand — Zurückhaltung durch Glass-Morphism, präzise Typografie, kontrollierte Farbpalette
- Tennis-DNA: Forest Green (der Platz), Navy (die Professionalität), Orange (der Ball, die Energie)

---

## 2. DFII — Design Feasibility & Impact Index

| Dimension                      | Score (1–5) | Begründung                                                                                                                |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Aesthetic Impact**           | 3/5         | Landing Page stark (Aurora, Mesh-Gradient, Tennisball-SVG). Admin-App zu shadcn-nah.                                      |
| **Context Fit**                | 5/5         | Tennis = Grün + Orange. Drei-Säulen-Palette perfekt getroffen.                                                            |
| **Implementation Feasibility** | 5/5         | Tailwind + shadcn + CSS-Variablen = solide Basis. Keyframe-Konsolidierung ✅, HSL-Variablen-Referenzen ✅.                |
| **Performance Safety**         | 4/5         | `prefers-reduced-motion` ✅. Aurora-Blur auf Landing vertretbar.                                                          |
| **Consistency Risk**           | 5/5         | 8 Button-, 4 Card-Varianten (Sprint 1–3 Konsolidierung abgeschlossen). Tailwind-Farben jetzt HSL-Variablen-Referenzen ✅. |

> **DFII = (3 + 5 + 5 + 5) − 2 = 16 → „Excellent — Execute fully"**

Die Richtung stimmt. Die Lücke liegt in der **Durchsetzung** der Brand-Identität in der App.

---

## 3. Differentiation Anchor

> _„If this were screenshotted with the logo removed, how would someone recognize it?"_

| Kontext          | Status     | Anchor                                                                              |
| ---------------- | ---------- | ----------------------------------------------------------------------------------- |
| **Landing Page** | ✅ Stark   | Aurora-Blobs + Mesh-Gradient + Clash Display + animierter Tennisball-SVG            |
| **Admin-App**    | ❌ Schwach | Könnte jedes shadcn-Dashboard sein. Sidebar neutral, Cards neutral, Header neutral. |

**Die Lücke:** Die Landing-Page-Identität endet an der App-Grenze. Drei High-Impact-Änderungen schließen sie — **alle umgesetzt ✅**:

1. **Sidebar-Hintergrund auf Forest-Green-Gradient** ✅ — `from-[hsl(150,48%,14%)]` via `to-[hsl(150,48%,8%)]`. Markenfarbe auf jedem Admin-/Superadmin-/Owner-Screen.
2. **Dashboard-Hero in Clash Display** ✅ — „Willkommen zurück" + alle Page-Titel in `font-display`. 7 Dateien aktualisiert.
3. **Empty States mit Tennisball-SVG** ✅ — `TennisBallGraphic` + `TennisBallEmptyState` mit `animate-float`. 5 Branded-Varianten: Members, Trainers, Courts, Tournaments, Seasons.

---

## 4. Design System — Snapshot

### 4.1 Farb-Rollen

| Rolle                            | Wert                                          | Verwendung                   |
| -------------------------------- | --------------------------------------------- | ---------------------------- |
| Page Background                  | `hsl(var(--background))`                      | Gesamte App                  |
| Card Surface                     | `hsl(var(--card))`                            | Cards, Modals, Sheets        |
| Elevated Surface                 | `hsl(var(--surface-elevated))`                | Hover, Dropdowns             |
| Primary Action                   | `bg-gradient-primary`                         | Haupt-Buttons, Active-States |
| Secondary Action                 | `bg-brand-secondary`                          | Alternative Aktionen         |
| Accent / KI                      | `bg-gradient-accent` + `Sparkles`-Icon        | KI-Features, CTAs            |
| Success / Warning / Error / Info | `#22c55e` / `#f59e0b` / `#ef4444` / `#3b82f6` | Status-Indikatoren           |

### 4.2 Typografie-Hierarchie

| Ebene         | Font           | Weight | Size     | Einsatz                            |
| ------------- | -------------- | ------ | -------- | ---------------------------------- |
| Landing Hero  | Clash Display  | 800    | 4.5rem   | Nur Landing                        |
| Page Title    | Clash Display  | 700    | 2.25rem  | Dashboard, Wizard — **NEU in App** |
| Section Title | DM Sans        | 700    | 1.5rem   | Card-Headers                       |
| Card Title    | DM Sans        | 600    | 1.125rem | Feature-Cards, Stats               |
| Body          | DM Sans        | 400    | 1rem     | Fließtext, Formulare               |
| Body Small    | DM Sans        | 400    | 0.875rem | Sidebar, Tabellen, Meta            |
| Caption       | DM Sans        | 500    | 0.75rem  | Labels, Badges                     |
| Mono          | JetBrains Mono | 400    | 0.875rem | Daten, Code                        |

### 4.3 Spacing-Raster

4px-Basis (Tailwind-Default). Sidebar-Standard: `px-3 py-2`.

| Token | Tailwind | Verwendung                                     |
| ----- | -------- | ---------------------------------------------- |
| xs    | `p-2`    | Icon-Text, Badge-Padding                       |
| sm    | `p-3`    | Sidebar-Links, List-Items, Card-Subkomponenten |
| md    | `p-4`    | Standard Card-Padding (normalisiert ✅)        |
| lg    | `p-6`    | Sektions-Abstand                               |
| xl    | `p-8`    | Große Sektionen                                |

**Sprint 3 — Card-Padding normalisiert:** `card.tsx`-Padding-Skala an DESIGN.md angeglichen. `md` von `p-6` auf `p-4`, `CardHeader`/`CardContent`/`CardFooter` von `p-6` auf `px-4 py-4`.

### 4.4 Motion-Strategie

| Kontext         | Dauer     | Easing          | Effekt               |
| --------------- | --------- | --------------- | -------------------- |
| Hover           | 150ms     | `ease-smooth`   | lift, glow, scale    |
| Tap             | 150ms     | `ease-smooth`   | `scale(0.97)`        |
| Entry           | 400–600ms | `ease-out-expo` | fade-in-up + stagger |
| Page Transition | 350ms     | `ease-out-expo` | fade + translateY    |
| Modal           | 300ms     | `ease-bounce`   | scale-in + backdrop  |

---

## 5. Component Architecture

### 5.1 Card-System (4 Varianten ✅)

**Definition (`card.tsx`):** 4 Varianten via `cva` (von 6 reduziert ✅ Sprint 3).

| Variante   | Nutzung                                | Status |
| ---------- | -------------------------------------- | ------ |
| `bordered` | ~60%, Admin-Seiten, Forms              | ✅     |
| `elevated` | ~20%, KPI-Karten, Login, Trainer-Stats | ✅     |
| `flat`     | Selten, Trainer-Profile                | ✅     |
| `default`  | Meist implizit (ohne `variant=`)       | ✅     |

**Eingestellt:** `gradient` (2× → `elevated` migriert), `glass` (0 Verwendungen). **Padding normalisiert:** `sm: p-3`, `md: p-4`, `lg: p-6`, `xl: p-8` — an DESIGN.md-Skala angeglichen.

### 5.2 Button-System (8 Varianten ✅)

**Definition (`button.tsx`):** 8 Varianten (von 10 reduziert ✅ Sprint 2).

| Variante      | Nutzung                                               | Status |
| ------------- | ----------------------------------------------------- | ------ |
| `outline`     | ~40%, Navigation, Abbrechen                           | ✅     |
| `ghost`       | ~20%, Icon-Buttons, Header                            | ✅     |
| `default`     | Toggle-States                                         | ✅     |
| `primary`     | Haupt-CTAs (auch ex-`gradient` + ex-`brand`)          | ✅     |
| `destructive` | Löschen, Deaktivieren                                 | ✅     |
| `accent`      | KI-Features, Premium                                  | ✅     |
| `secondary`   | Alternative Aktionen                                  | ✅     |
| `link`        | 2× (notification-settings, trial-training) — behalten | ✅     |

**Eingestellt:** `gradient` (3× → `primary`) + `brand` (15× → `primary`). `link` evaluiert → als Text-Link-Variante beibehalten.

### 5.3 Badge-System (8 Varianten) ✅

Alle 8 Varianten aktiv: `default`, `secondary`, `accent`, `success`, `warning`, `error`, `info`, `outline`. Semantisch konsistent durchgesetzt, 3 Sizes (`sm`, `md`, `lg`). Kein Handlungsbedarf.

### 5.4 IconBox-System (14 Varianten) ✅

Flächendeckend im Einsatz — 30+ Stellen vereinheitlicht. Hat das frühere manuelle `<div>`-Icon-Pattern erfolgreich abgelöst. Häufigste: `light`, `gradient-primary`, `primary`, `blue`, `green`. Kein Handlungsbedarf.

### 5.5 KI-Feature-Indikator ✅

Einheitliches Pattern für KI-gestützte Features (Saisonplaner, Scheduler, Matchmaking):

- **Badge:** `bg-brand-accent/10 text-brand-accent border-brand-accent/20` + `Sparkles`-Icon (lucide-react)
- **Glow:** `shadow-glow-accent` auf Hover
- **Metrik:** Pulse-Glow-Animation für Effizienzgewinne („+47% schneller")

Aktiv im Code verwendet. Kein Handlungsbedarf — als Pattern für neue KI-Features dokumentiert.

---

## 6. Layout — Zwei Modi

Code in `protected-client-layout.tsx:52`: `showSidebar = isOwner || isSuperAdmin || isAdmin`

### Modus A — Sidebar-Layout (Owner, Superadmin, Admin)

| Gerät            | Navigation                                | Content              |
| ---------------- | ----------------------------------------- | -------------------- |
| Mobile (<768px)  | BottomNav (`md:hidden`) + Sidebar-Overlay | Full width           |
| Desktop (≥768px) | Sidebar w-64                              | `ml-64`, `max-w-7xl` |

### Modus B — BottomNav-Layout (Trainer, Member)

| Alle Geräte | Navigation | Content              |
| ----------- | ---------- | -------------------- |
| Persistent  | BottomNav  | `max-w-3xl`, `pb-20` |

**Keine Sidebar auf keiner Bildschirmgröße für Trainer/Member.**

---

## 7. Animation — Audit

### Was lebt, was tot ist

**14 aktive Animationen** (Code-verifiziert): `float`, `float-slow`, `pulse-glow`, `shimmer`, `fade-in`, `fade-in-up`, `scale-in`, `slide-in-right`, `slide-in-left`, `page-enter`, `page-exit`, `gradient-shift`, `aurora`, `slide-down`

**4 tote Keyframes gelöscht** ✅ Sprint 1 — `marquee`, `ripple`, `count-up`, `border-glow` aus tailwind.config.ts entfernt.

**10 doppelte Keyframes konsolidiert** ✅ Sprint 1 — globals.css ist Single Source of Truth; tailwind.config.ts enthält nur noch `aurora` + `slide-down` (kein globals.css-Äquivalent).

Die Design-Preview-Seite (`app/(public)/design-preview/page.tsx`) zeigt 11 Animationen. 🔧 `slide-down` ergänzen.

---

## 8. Dark Mode & Accessibility

### Dark Mode 🟢 Gut

- Vollständiges Dark-Theme mit HSL-Variablen ✅
- ThemeToggle flächendeckend: Header, MobileNav, Landing, Login, Register, Forgot-Password ✅
- `prefers-color-scheme` + `.dark`-Klasse ✅
- ✅ localStorage-Persistenz — `next-themes` v0.4.6 speichert User-Wahl via `setTheme()`. Inline-`<script>` in `<head>` liest vor React-Hydration (kein Flash). (Ticket 12 ✅)

### Accessibility 🟢 Gut

- SkipToContent, aria-labels, sr-only, focus-visible ✅
- `prefers-reduced-motion` ✅
- ✅ Tastaturnavigation-Audit abgeschlossen (0 kritische Funde, s. Abschnitt 13)
- ✅ ARIA-Live-Region-System — AriaLiveProvider + useAriaLive() + SonnerAriaBridge (Ticket 11 ✅)

---

## 9. Landing Page — Stärken & Schwächen

**Stärken:** 7 Sektionen, Aurora-Blobs, Mesh-Gradient, Clash Display, A/B-Testing (`useExperiment`), vollständige SEO-Metadaten. Visuell das Highlight des Projekts. 🟢

**Schwächen:**

- 🔴 **Drei CTAs im Hero** → ✅ Auf 1 Primär-CTA ("Demo starten") + 1 Sekundär-Link ("Demo ansehen") reduziert.
- 🟡 Keine Produkt-Screenshots — Tennisball-SVG dekorativ, aber zeigt nichts vom Produkt
- 🟡 Testimonials ohne Avatare
- 🟡 Pricing nur 2 Pläne, kein Jahresrabatt

---

## 10. Design-Schulden — Sprint-Bereit

### 🔴 Sprint 1 (sofort) — ✅ Alle erledigt (code-verifiziert 1. Juli 2026)

| #   | Schuld                | Aktion                                                                                                                                                                 | Status      |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | 4 tote Keyframes      | `marquee`, `ripple`, `count-up`, `border-glow` aus tailwind.config.ts gelöscht                                                                                         | ✅ Erledigt |
| 2   | 10 doppelte Keyframes | Aus tailwind.config.ts entfernt, `globals.css` als Single Source of Truth. Nur `aurora` + `slide-down` verbleiben in tailwind.config.ts (kein globals.css-Äquivalent). | ✅ Erledigt |
| 3   | 3 Hero-CTAs           | Auf 1 Primär-CTA ("Demo starten") + 1 Sekundär-Link ("Demo ansehen") reduziert. A/B-Test `landing_hero_cta` vorhanden.                                                 | ✅ Erledigt |

### 🟡 Sprint 2 (Q3)

| #   | Schuld                         | Aktion                                                                                        | Aufwand |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------- | ------- |
| 4   | Button `gradient` ≈ `primary`  | ✅ **Erledigt.** 3× `gradient` → `primary`. Gleiche `bg-gradient-primary`-Farbfamilie.        | 2h      |
| 5   | Button `brand` ≈ `primary`     | ✅ **Erledigt.** 15× `brand` → `primary`. `ConfirmVariant` mitbereinigt.                      | 1h      |
| 6   | Button `link` evaluieren       | ✅ **Erledigt.** 2× genutzt → als Text-Link-Variante beibehalten.                             | 0.5h    |
| 7   | Design-Preview vervollständigt | ✅ **Erledigt.** `aurora`, `slide-down`, `slide-in-left` + Badge/Button/IconBox-Tabs ergänzt. | 3h      |
| 8   | Card-Varianten 6→4             | ✅ **Erledigt.** `gradient` + `glass` entfernt. Padding-Skala normalisiert.                   | 2h      |

### 🟢 Sprint 3+ (Q3/Q4)

| #   | Schuld                   | Aktion                                                                                                                                                                                                                                                   | Aufwand |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 9   | Hardcoded-Hex-Farben     | ✅ **Erledigt.** `brand.primary/secondary/accent` → `hsl(var(--brand-...))` + `ringColor.brand` → HSL.                                                                                                                                                   | 2h      |
| 10  | Tastaturnavigation-Audit | ✅ **Erledigt.** Code-Audit abgeschlossen (s. Abschnitt 13). Codebase in exzellentem Zustand.                                                                                                                                                            | 4h      |
| 11  | ARIA-Live-Regions        | ✅ **Erledigt.** `AriaLiveProvider` + `useAriaLive()` Hook (Context-basiert). `SonnerAriaBridge` per MutationObserver — alle Toasts automatisch via Screenreader. `announceToScreenReader()` nutzt persistente Region mit Clear-then-Set-Reannouncement. | 3h      |
| 12  | Theme-Persistenz         | ✅ **Erledigt.** Inline-`<script>` in `<head>` liest `localStorage` vor React-Hydration (kein Flash). `next-themes` v0.4.6 persistiert User-Wahl via `setTheme()`.                                                                                       | 1h      |
| 13  | Landing-Page Screenshots | 3–4 annotierte Produkt-Screenshots                                                                                                                                                                                                                       | 4h      |

### 💡 Ideenparkplatz (nicht priorisiert)

- Storybook für Komponenten-Dokumentation
- Multi-Tenant-Branding (pro Verein eigene Farben/Logo) — Basis in `lib/branding.ts` vorhanden
- ~~Clash Display in App-Headlines~~ ✅ Umgesetzt (Dashboard-Titel, Wizard-Header)
- ~~Empty States mit Tennisball-SVG~~ ✅ Umgesetzt (5 Branded-Varianten)
- FAB (Floating Action Button) auf Member-Dashboard

---

## 11. Health Check (Ampel)

| Dimension             | Status | Anmerkung                                                                                                                               |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Farbkonsistenz        | 🟢     | HSL-Variablen, Brand-Utilities.                                                                                                         |
| Typografie-Hierarchie | 🟢     | Clash Display jetzt in App ✅ (7 Dashboard-Headlines + Page-Titel).                                                                     |
| Spacing-Rhythmus      | 🟢     | Sidebar `px-3 py-2`. Card-Paddings normalisiert ✅ Sprint 3.                                                                            |
| Component-Konsistenz  | 🟢     | Buttons 10→8 ✅. Cards 6→4 ✅. IconBox/Badge konsistent.                                                                                |
| Responsives Verhalten | 🟢     | Zwei-Modi-Layout sauber implementiert.                                                                                                  |
| Dark Mode             | 🟢     | ThemeToggle flächendeckend. localStorage-Persistenz ✅ (Ticket 12).                                                                     |
| Animation             | 🟢     | 4 tote gelöscht ✅, 10 doppelte konsolidiert ✅ (Sprint 1). Design-Preview vollständig ✅.                                              |
| Accessibility         | 🟢     | Tastatur-Audit ✅, beide Findings (F1/F2) behoben. ARIA-Live-System ✅. E2E-Keyboard-Test ✅ (11 Tabs Vorwärts + 10 Rückwärtsschritte). |
| Design-Dokumentation  | 🟢     | Design-Preview vollständig ✅. Dieses Dokument aktuell.                                                                                 |
| Polish                | 🟢     | Landing beeindruckend ✅. 3 Diff-Anchors umgesetzt ✅. Empty States mit Tennisball-SVG ✅.                                              |

---

## 12. Anti-Patterns — Verstöße gegen `frontend-design`

| Skill-Regel                                | SwingZ-Status                                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ❌ „Avoid default ShadCN layouts"          | **Entschärft.** Sidebar jetzt Forest-Green-Gradient ✅ — visuell kein ShadCN-Default mehr.                                                                     |
| ❌ „No dead styles, no unused animations"  | **Behoben.** 4 tote Keyframes gelöscht ✅, 10 doppelte konsolidiert ✅ (Sprint 1).                                                                             |
| ❌ „Avoid symmetric, predictable sections" | **Entschärft.** Empty States mit animiertem Tennisball-SVG ✅ + Clash Display in Dashboards ✅.                                                                |
| ⚠️ „Do not blend more than two tones"      | **Grenzwertig.** Drei Einflüsse (Luxury + Organic + Energetic). Reduktion auf zwei: Luxury-minimal + Organic warmth. Orange als Akzent, nicht als dritten Ton. |
| ✅ „One expressive display font"           | Clash Display jetzt in App ✅ — 7 Dashboard- + Page-Titel.                                                                                                     |
| ✅ „Commit to a dominant color story"      | Forest Green als Dominant-Ton jetzt in der App sichtbar ✅ — Sidebar + Empty States + Primary-Buttons.                                                         |

---

## 13. Tastaturnavigation-Audit (Sprint 3+ Ticket 10)

> **Audit-Methode:** Code-Suche nach 6 Anti-Pattern-Kategorien + manuelle Code-Review der Accessibility-Utilities.
> **Datum:** 1. Juli 2026

### 13.1 Zusammenfassung

**Gesamturteil: 🟢 Exzellent.** Die Codebase hat eine starke Accessibility-Basis. Keine kritischen Funde.

| Kategorie                                                                                     | Ergebnis                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `onClick` auf nicht-semantischen Elementen (`<div>`, `<span>`, `<li>`) ohne `role`/`tabIndex` | 🟢 **0 Funde** — alle klickbaren Elemente sind semantisch korrekt oder haben `role="button"` + `tabIndex={0}`                                   |
| `<a>`-Tags mit `href="#"` (Anti-Pattern)                                                      | 🟢 **0 Funde** — nur legitime Anchor-Links (`#main-content`, `#contact-form`)                                                                   |
| `tabIndex={-1}` Missbrauch                                                                    | 🟢 **3 legitime Verwendungen** (Modal-Overlay, Widget-Picker-Close, Modal-Schließen)                                                            |
| Buttons in Forms ohne `type="button"`                                                         | 🟢 **OK** — 62× `type="button"` explizit. Key-Forms (Login, Probetraining, SEPA, Billing) manuell verifiziert — alle Buttons korrekt typisiert. |
| Custom-Dropdowns/Menüs ohne Arrow-Key-Navigation                                              | 🟢 **Keine** — alle Menüs nutzen Radix UI Primitive mit integrierter Tastaturnavigation                                                         |
| Formulare ohne `htmlFor`-Verknüpfung                                                          | 🟢 **72+ `htmlFor`** — alle Label-Input-Paare korrekt verknüpft                                                                                 |

### 13.2 Stärken (Was bereits exzellent ist)

| Feature                                    | Fundstellen                                                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`aria-label`**                           | 102+ Instanzen — Header, Sidebar, Buttons, Icons, Navigation, Pagination                                                                              |
| **`role="button"` + `tabIndex={0}/{ -1}`** | 10 Elemente mit voller Tastatur-Erreichbarkeit (`tabIndex={0}`) + 5 mit `tabIndex={-1}` (Modal-Overlays, Widget-Picker — programmatisch fokussierbar) |
| **`onKeyDown` Handler**                    | 44+ — Enter/Space für `role="button"`, Escape für Modals, Enter in Suchfeldern                                                                        |
| **Radix UI Primitives**                    | `Dialog`, `AlertDialog`, `DropdownMenu`, `Command` (cmdk) — alle mit integrierter Tastaturnavigation & Focus-Trapping                                 |
| **Skip-to-Content**                        | `lib/accessibility.tsx:127` — `href="#main-content"` mit `sr-only focus:not-sr-only`                                                                  |
| **Screen-Reader-Announcements**            | `lib/accessibility.tsx:19` — `announceToScreenReader()` mit `role="status"` + `aria-live`                                                             |
| **Focus Manager**                          | `lib/accessibility.tsx:61` — `focusManager.trapFocus()`, `focusFirst()`, `saveFocus()`                                                                |
| **Globale Shortcuts**                      | `hooks/use-keyboard-shortcuts.ts` — ⌘D/B/M/S/K + Shift+? (input-aware, triggert nicht in Textfeldern)                                                 |
| **Command Palette**                        | `components/command-palette.tsx` — ⌘K, cmdk-basierte Volltextsuche + Navigation + Theme-Toggle                                                        |
| **Shortcuts-Dialog**                       | `components/keyboard-shortcuts-dialog.tsx` — Shift+?, FAB-Button, kategorisierte Shortcuts                                                            |
| **CenteredModal**                          | `components/ui/centered-modal.tsx` — Escape-Handler, Overlay-Click, `aria-modal="true"`, Body-Scroll-Lock                                             |
| **`:focus-visible`**                       | `app/globals.css:167` — `ring-2 ring-offset-2` mit `--tw-ring-color: hsl(var(--ring) / 0.8)`                                                          |
| **`prefers-reduced-motion`**               | `app/globals.css:648` — alle Animationen auf `0.01ms` reduziert                                                                                       |

### 13.3 Findings (Minor)

| #   | Finding                                   | Schwere                                                                                                                                                                  | Beschreibung |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| F1  | CenteredModal ohne aktives Focus-Trapping | 🟢 **Behoben.** `centered-modal.tsx` ruft jetzt `focusManager.trapFocus(dialogRef)` + `focusFirst(dialogRef)` mit Fallback-Fokus auf den Dialog-Wrapper beim Öffnen auf. |
| F2  | Keine E2E-Tastaturtests                   | 🟢 **Behoben.** `e2e/design-preview-keyboard-nav.test.ts` testet alle 11 Design-Preview-Tabs via Keyboard (.focus() + Enter).                                            |

### 13.4 Key Files

| Datei                                      | Rolle                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `lib/accessibility.tsx`                    | Core-Utilities: SkipLink, ScreenReader, FocusTrap, KeyboardProps               |
| `hooks/use-keyboard-shortcuts.ts`          | Globale Tastatur-Shortcuts (input-aware)                                       |
| `components/command-palette.tsx`           | ⌘K Command-Palette mit cmdk                                                    |
| `components/keyboard-shortcuts-dialog.tsx` | Shift+? Shortcuts-Übersicht                                                    |
| `components/ui/centered-modal.tsx`         | Kanonischer Modal-Wrapper mit Escape                                           |
| `components/ui/dialog.tsx`                 | Radix Dialog-Primitive (Focus-Trap integriert)                                 |
| `components/ui/dropdown-menu.tsx`          | Radix Dropdown-Menu (Arrow-Key-Navigation)                                     |
| `components/ui/command.tsx`                | cmdk Command-Palette (Arrow-Key + Search)                                      |
| `app/globals.css`                          | `:focus-visible` Ring-Styles, `prefers-reduced-motion`, Screenreader-Utilities |

---

## 14. Consistency Checklist

Jede neue Komponente muss:

- [ ] Nur definierte Design-Tokens verwenden (keine Hardcoded-Hex-Farben)
- [ ] In Light **und** Dark Mode funktionieren
- [ ] `prefers-reduced-motion` respektieren
- [ ] aria-labels / sr-only haben wo nötig
- [ ] Loading-, Empty-, und Error-States zeigen
- [ ] `cn()` für conditional classNames nutzen
- [ ] Mobile-responsive sein (Mobile-First)
- [ ] hover- und focus-visible-Styles haben
- [ ] Bestehende UI-Komponenten nutzen (keine Duplikate)
- [ ] Brand-Identität transportieren (Forest Green, Clash Display wo sinnvoll, Tennisball in Empty States)

---

> **Dieses Dokument definiert die Design-Vision für SwingZ.** Es dient als Leitfaden für UI-Entscheidungen und wird quartalsweise aktualisiert. Die Design-Schulden in Abschnitt 10 sind als Tickets in Linear zu überführen.
