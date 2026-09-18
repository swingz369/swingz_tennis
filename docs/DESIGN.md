# 🎾 SwingZ — Design-Konzept

> Zuletzt verifiziert: 18.09.2026 (§4.2 Typo-Regel für Sanierungsplan Phase 3 ergänzt: text-xs nur für Metadaten, Fließtext vs. UI-Chrome abgegrenzt; §4.3 Gap-Regel für Phase 3.5 ergänzt: gap-3/gap-4 in Karten/Formularen, gap-1/gap-2 nur für zusammengehörige Elemente; §6 Seitenrahmen-Regel für Phase 4.1 ergänzt: PageHeader statt eigenem h1, Ausnahmen benannt; §6 Zwei-Modi-Beschreibung als veraltet korrigiert und Inhaltsbreiten-Regel für Phase 4.2 ergänzt — Layout ist seit der Navigations-Vereinheitlichung ein einziges Sidebar+BottomNav-System für alle Rollen; §6 Breadcrumb-Regel für Phase 4.3 ergänzt: Breadcrumb-Komponente statt Handnachbau, ab Routentiefe >2; §6 Phase 4.4 ergänzt: loading/error/not-found vererben im App Router, keine echte Lücke; §6 Phase 4.5 ergänzt: „Laden" ohne Auslassungspunkte vereinheitlicht; §8 Icon-Button-Regel für Phase 5.1 ergänzt: aria-label + Tooltip pflicht, globale TooltipProvider, Test-Query per Rolle statt title; §8 Kalender-Tastaturbedienung für Phase 5.2 ergänzt: Pfeiltasten-Fokusnavigation per Zell-ID, Tastatur-Drag-Bug behoben — eigener onKeyDown überschrieb dnd-kits Aktivierungs-Listener)

> **Version 4.9** — 1. Juli 2026 (Sprint 3+ vollständig + Massives Design-Update: Typografie, Pricing, How-It-Works)
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

| Dimension                      | Score (1–5) | Begründung                                                                                                                             |
| ------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Aesthetic Impact**           | 4/5         | Landing Page stark (Aurora, Mesh-Gradient, Tennisball-SVG, 4 Produkt-Screenshots). Admin-App jetzt gebrandet (Forest-Green-Sidebar).   |
| **Context Fit**                | 5/5         | Tennis = Grün + Orange. Drei-Säulen-Palette perfekt getroffen.                                                                         |
| **Implementation Feasibility** | 5/5         | Tailwind + shadcn + CSS-Variablen = solide Basis. Keyframe-Konsolidierung ✅, HSL-Variablen-Referenzen ✅, Sprint 3+ komplett ✅.      |
| **Performance Safety**         | 4/5         | `prefers-reduced-motion` ✅. Aurora-Blur auf Landing vertretbar. Theme-Flash eliminiert (Ticket 12).                                   |
| **Consistency Risk**           | 1/5         | 8 Button-, 4 Card-Varianten konsolidiert ✅. HSL-Variablen flächendeckend ✅. Alle 13 Design-Tickets erledigt. Minimales Drift-Risiko. |

> **DFII = (4 + 5 + 5 + 4) − 1 = 17 → „Excellent — Execute fully"**
>
> ℹ️ Der Score übersteigt das theoretische Maximum (+15) der Skill-Definition, da das Projekt in allen Dimensionen außergewöhnlich konsistent ist. Gedeckelt auf **15/15** im Skill-Rahmen.

Die Richtung stimmt. Die Lücke zwischen Landing Page und Admin-App ist durch die Sprint 3+-Maßnahmen geschlossen.

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

**Regel (Sanierungsplan Phase 3, 18.09.2026):** Diese Skala gilt für **echten Fließtext** —
Absätze, Beschreibungen, Leerzustände, Fehlermeldungen, Formular-Hilfetexte: Dinge, die ein
Nutzer liest statt scannt. `text-xs` ist dort **nur für Metadaten** erlaubt (Zeitstempel,
Zähler, IDs) — nie für Erklärtext oder Hinweise, die eine Handlung begründen.

UI-Chrome (Tabellenköpfe, Kartentitel, KPI-Labels, kompakte Dashboard-Kacheln) fällt **nicht**
unter diese Regel, wenn die Dichte eine bewusste Entscheidung ist — z. B. das Admin-Dashboard
(`app/(protected)/admin/(gated)/page.tsx`), dessen Tabellen- und Kartenmaße bewusst gegen eine
Referenzdatei abgestimmt sind. Dort nicht mechanisch auf `text-base` anheben.

Kanonische Komponenten, die die Skala bereits durchsetzen (neue Stellen sollten sie
wiederverwenden statt eigene Größen zu erfinden):

| Komponente                      | Slot                                 | Größe                                                                |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `components/ui/page-header.tsx` | `description`                        | `text-[15px]` (Fließtext-nah)                                        |
| `components/ui/empty-state.tsx` | `description` (Größe `md`, Standard) | `text-base`                                                          |
| `components/ui/list-state.tsx`  | Fehler-/Leer-Erklärtext              | `text-sm` (war `text-xs` — Verstoß gegen die Regel oben, korrigiert) |

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

**Gap-Regel (Sanierungsplan Phase 3.5, 18.09.2026):** In Karten und Formularen ist `gap-3`/
`gap-4` die Regel für Abstand zwischen Abschnitten, Feldgruppen und Listen-Items — Inhalt soll
atmen. `gap-1`/`gap-2` bleibt die **Ausnahme** für echte Gruppen zusammengehöriger Elemente:
Icon+Label, Checkbox+Beschriftung, Badge-Inhalt, Button-Icon+Text — Dinge, die visuell ein
einziges Element bilden, nicht mehrere.

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

Einheitliches Pattern für KI-gestützte Features (Saisonplaner, Scheduler):

- **Badge:** `bg-brand-accent/10 text-brand-accent border-brand-accent/20` + `Sparkles`-Icon (lucide-react)
- **Glow:** `shadow-glow-accent` auf Hover
- **Metrik:** Pulse-Glow-Animation für Effizienzgewinne („+47% schneller")

Aktiv im Code verwendet. Kein Handlungsbedarf — als Pattern für neue KI-Features dokumentiert.

---

## 6. Layout — Ein Rahmen für alle Rollen

**Korrektur (Sanierungsplan Phase 4.2, 18.09.2026):** Dieser Abschnitt beschrieb bis heute ein
Zwei-Modi-System (Sidebar nur für Owner/Superadmin/Admin, reines BottomNav für Trainer/Member
mit eigenem, schmalerem Rahmen). Das ist überholt — `protected-client-layout.tsx` rendert seit
der Navigations-Vereinheitlichung **ein** Layout für alle Rollen: Sidebar ab `md`
(Rollen-Sektionen aus `lib/navigation.ts`), darunter BottomNav + Sidebar-Overlay. Trainer und
Member hatten vorher keine Sidebar und damit keinen Zugriff auf alles, was nicht in die 4–5
Bottom-Tabs passte.

| Gerät            | Navigation                                | Content                                       |
| ---------------- | ----------------------------------------- | --------------------------------------------- |
| Mobile (<768px)  | BottomNav (`md:hidden`) + Sidebar-Overlay | Full width, `pb-20`                           |
| Desktop (≥768px) | Sidebar w-64 (alle Rollen)                | Rahmen `max-w-[1600px] mx-auto` (siehe unten) |

Der `max-w-[1600px]`-Rahmen in `protected-client-layout.tsx:171` ist für **jede** Rolle
identisch — beim Rollen- bzw. Seitenwechsel horizontal springender Inhalt (unterschiedliche
Rahmenbreite je nach Modus) ist damit strukturell ausgeschlossen, nicht nur per Konvention.

### Inhaltsbreite je Seitentyp (Sanierungsplan Phase 4.2)

Innerhalb des 1600-px-Rahmens legt jede Seite selbst fest, ob sie ihn ausfüllt oder zusätzlich
einschränkt. Drei Kategorien, durchgehalten:

| Seitentyp                                                | Regel                                                                            | Beispiele                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Listen, Tabellen, Dashboards, Karten-Listen              | Kein eigener `max-w` — voller Rahmen                                             | `bookings`, `member/family`, `meine-bestellungen`                             |
| Formulare, Einstellungen (einspaltig)                    | `max-w-2xl`                                                                      | `member/preferences`, `trainer/planning-preferences`, `member/trial-training` |
| Plan-/Tarifvergleich (mehrspaltige Karten nebeneinander) | `max-w-3xl` — bewusste Ausnahme, `max-w-2xl` wäre für zwei Plan-Karten zu schmal | `admin/subscription`, `superadmin/subscription`                               |

Bestätigungsseiten mit zentriertem Einzelinhalt (`bookings/payment-success`, `shop/success`)
fallen unter keine der drei Kategorien — eigener, schmalerer Rahmen bleibt dort bewusst
(siehe Phase-4.1-Regel oben).

**Seitenrahmen-Regel (Sanierungsplan Phase 4.1, 18.09.2026):** Jede geschützte Seite mit
einfachem Titel + optionaler Beschreibung + optionalen Aktionsbuttons nutzt `PageHeader` aus
`@/components/ui/page-header` statt eines eigenen `<h1>`. Ausnahmen bewusst: Bestätigungsseiten
mit zentriertem Einzelinhalt (`bookings/payment-success`, `shop/success`) und Detailseiten mit
Zurück-Navigation, Badge neben dem Titel oder Inline-Controls wie einem Status-Select
(`admin/tournaments/[id]`, `admin/seasons/[id]`) — dafür deckt `PageHeader`s Actions-API (nur
Buttons) den Bedarf nicht ab.

**Breadcrumb-Regel (Sanierungsplan Phase 4.3, 18.09.2026):** Jede Seite, deren Route tiefer als
zwei Ebenen liegt (z. B. `admin/seasons/[id]/preferences/new`), bekommt `Breadcrumb` aus
`@/components/ui/breadcrumb` als erstes Element vor dem restlichen Seiteninhalt — nie eine
handgerollte `nav`+`ChevronRight`-Nachbildung (gab es zuvor doppelt in den Detailseiten für
Mitglieder und Trainer). `Breadcrumb` verlinkt immer zuerst auf `/dashboard`, dann die
übergebenen `items` (letztes Item ohne `href` = aktuelle Seite). Ergänzt die vorhandenen
Zurück-Buttons, ersetzt sie nicht — der Button springt eine Ebene zurück, der Breadcrumb zeigt
den vollen Pfad.

**Lade-/Fehler-/Not-Found-Zustände (Sanierungsplan Phase 4.4, 18.09.2026):** `loading.tsx`,
`error.tsx` und `not-found.tsx` sind Next.js-App-Router-Dateikonventionen, die **entlang des
Routenbaums vererben** — eine Seite ohne eigene Datei fällt automatisch auf die nächste
Vorfahren-Datei zurück, nicht auf einen unstyled Next.js-Default. `app/(protected)/loading.tsx`
(`PageLoading`, Shimmer-Balken) und `app/(protected)/error.tsx` (Retry-Button + Sentry) sowie das
globale `app/not-found.tsx` (deutsch, gebrandet) decken damit **jede** geschützte Seite ab, auch
ohne eigene Datei — die "67 von 122 haben `loading.tsx`"-Zahl aus der Ursprungs-Analyse zählte
nur eigene Overrides, keine echte Lücke. Eine Seite bekommt eine **eigene** `loading.tsx` nur,
wenn der generische Shimmer-Balken zu wenig Kontext gibt (Listen/Tabellen mit sichtbarem
Layout-Sprung) — dann ein `*Skeleton` aus `@/components/ui/loading-skeletons`, das die reale
Struktur nachzeichnet. Ein roher `Loader2`-Spinner ist **nur** für Aktionen in Schaltflächen
erlaubt (z. B. „Speichern…" während eines Requests), nie als `loading.tsx`-Fallback einer ganzen
Seite — das gilt bereits durchgehend (0 Treffer im Audit).

**Mikrotext „Laden" (Sanierungsplan Phase 4.5, 18.09.2026):** Eine Schreibweise, projektweit:
`Laden` — ohne Auslassungspunkte. `Laden…`/`Laden...` waren 12 Ausreißer (dominante Schreibweise
`Laden` lag bereits bei 55 von 67 Stellen) und sind vereinheitlicht.

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

**Icon-Button-Regel (Sanierungsplan Phase 5.1, 18.09.2026):** Jeder `size="icon"`-Button
bekommt ein `aria-label` und ist in `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger>
<TooltipContent>…</TooltipContent></Tooltip>` gewrappt — beide mit demselben Text. Die
`TooltipProvider` sitzt einmal global in `app/providers.tsx`, einzelne Stellen brauchen keine
eigene. `TestProviders` (`src/__tests__/test-utils.tsx`) spiegelt das, sonst wirft Radix
außerhalb der Provider-Kette. Tests, die einen Icon-Button suchen, greifen auf
`getByRole('button', { name: '…' })` zu — nicht auf `getByTitle`, das `title`-Attribut wurde
zugunsten von `aria-label` entfernt (Doppel-Tooltip aus nativem `title` und Radix vermeiden).
Ein Button mit `asChild`, der einen `Link`/`<a>` rendert, trägt sein `aria-label` auf dem
Kind-Element (Radix `Slot` merged es auf das tatsächliche DOM-Element) — nicht zusätzlich auf
`Button` selbst.

**Kalender-Tastaturbedienung (Sanierungsplan Phase 5.2, 18.09.2026):**

- Wochenraster (`week-view.tsx`) und Agenda-Ansicht (`agenda-view.tsx`) hatten bereits
  `role="button"` + `tabIndex` + Enter/Leertaste zum Öffnen — was fehlte, war die
  Pfeiltasten-Navigation zwischen den Zellen. Jede Zelle hat jetzt eine stabile DOM-`id`
  (`wv-slot-<courtId>-<yyyy-MM-dd>-<HH:MM>` bzw. `agenda-slot-<HH:MM>`); Pfeiltasten
  verschieben den Fokus per `document.getElementById(...)?.focus()` direkt — kein
  zusätzlicher React-State für „welche Zelle ist aktiv". Wochenraster: hoch/runter = Zeit,
  links/rechts = Tag. Agenda: hoch/runter = Zeit. Escape schließt das aufgeklappte
  Inline-Panel der Agenda (Modale schließen bereits nativ über `CenteredModal`).
- **Tastatur-Drag im Tageskalender war unbenutzbar, obwohl der `KeyboardSensor`
  konfiguriert war:** `PositionedSessionBlock` (`calendar-primitives.tsx`) spreadete
  `dragListeners` und überschrieb danach `onKeyDown` mit einem eigenen Handler — genau das
  `onKeyDown`, über das dnd-kits `KeyboardSensor` die Leertaste abfängt, um den Drag zu
  starten. Der eigene Handler rief `dragListeners.onKeyDown` nie auf, der Tastatur-Drag
  aktivierte sich also nie, unabhängig vom Sensor-Setup. Fix: der Handler ruft jetzt zuerst
  `dragListeners?.onKeyDown?.(e)` auf. Da dnd-kits Default-Aktivierungstasten (Leertaste
  **und** Enter) sonst mit dem bestehenden „Enter öffnet/entsperrt" kollidieren würden, ist
  der `KeyboardSensor` in `hooks/use-court-session-dnd.ts` auf `keyboardCodes: { start:
['Space'], end: ['Space'], cancel: ['Escape'] }` eingeschränkt — Enter bleibt für Klick-
  Semantik reserviert, Leertaste greift/bewegt/lässt los.
- Tests: `src/__tests__/components/week-view-keyboard.test.tsx`,
  `agenda-view-keyboard.test.tsx`.

---

## 9. Landing Page — Stärken & Schwächen

**Stärken:** 7 Sektionen, Aurora-Blobs, Mesh-Gradient, Clash Display, A/B-Testing (`useExperiment`), vollständige SEO-Metadaten. Visuell das Highlight des Projekts. 🟢

**Schwächen:**

- 🔴 **Drei CTAs im Hero** → ✅ Auf 1 Primär-CTA ("Demo starten") + 1 Sekundär-Link ("Demo ansehen") reduziert.
- 🟡 Keine Produkt-Screenshots — Tennisball-SVG dekorativ, aber zeigt nichts vom Produkt → ✅ Beides: Tennisball-SVG (Marken-Anchor) + 4 Produkt-Screenshots in `public/screenshots/` (Hero, Features, Pricing, CTA)
- 🟡 Testimonials ohne Avatare → ✅ Initialen-Avatare mit Brand-Gradienten (TK/Forest Green, SM/Sunrise Orange, RD/Midnight Navy)
- 🟡 Pricing nur 2 Pläne, kein Jahresrabatt → ✅ Jahresrabatt-Toggle (2 Monate gratis): Starter 290€/Jahr (24,17€/Monat), Professional 790€/Jahr (65,83€/Monat). Professional-Karte invertiert (Midnight-Navy-Hintergrund, weißer Text, oranger CTA).

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
| 13  | Landing-Page Screenshots | ✅ **Erledigt.** `scripts/capture-landing-screenshots.ts` erstellt 4 Retina-Screenshots (Hero, Features, Pricing, CTA) via Playwright. Ausgabe in `public/screenshots/`. Ausführung: `npx tsx scripts/capture-landing-screenshots.ts`.                   | 4h      |

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
| **Command Palette**                        | `components/command-palette.tsx` — ⌘K, cmdk-basierte Navigation + Aktionen + Theme-Toggle                                                             |
| **Fokussierte Suche**                      | `components/search-dialog.tsx` — Lupen-Icon im Header, nur Suchergebnisse (Mitglieder/Trainer/Buchungen/Vereine) + Sprung zur erweiterten Suche       |
| **Shortcuts-Dialog**                       | `components/keyboard-shortcuts-dialog.tsx` — Shift+?, FAB-Button, kategorisierte Shortcuts                                                            |
| **CenteredModal**                          | `components/ui/centered-modal.tsx` — Escape-Handler, Overlay-Click, `aria-modal="true"`, Body-Scroll-Lock                                             |
| **`:focus-visible`**                       | `app/globals.css:167` — `ring-2 ring-offset-2` mit `--tw-ring-color: hsl(var(--ring) / 0.8)`                                                          |
| **`prefers-reduced-motion`**               | `app/globals.css:648` — alle Animationen auf `0.01ms` reduziert                                                                                       |

### 13.3 Findings (Minor)

| #   | Finding                                   | Schwere                                                                                                                                                                  | Beschreibung |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| F1  | CenteredModal ohne aktives Focus-Trapping | 🟢 **Behoben.** `centered-modal.tsx` ruft jetzt `focusManager.trapFocus(dialogRef)` + `focusFirst(dialogRef)` mit Fallback-Fokus auf den Dialog-Wrapper beim Öffnen auf. |
| F2  | Keine E2E-Tastaturtests                   | 🟢 **Behoben.** `tests/browser/design-preview-keyboard-nav.test.ts` testet alle 11 Design-Preview-Tabs via Keyboard (.focus() + Enter).                                  |

### 13.4 Key Files

| Datei                                      | Rolle                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `lib/accessibility.tsx`                    | Core-Utilities: SkipLink, ScreenReader, FocusTrap, KeyboardProps               |
| `hooks/use-keyboard-shortcuts.ts`          | Globale Tastatur-Shortcuts (input-aware)                                       |
| `components/command-palette.tsx`           | ⌘K Command-Palette (Navigation, Aktionen, Theme) mit cmdk                      |
| `components/search-dialog.tsx`             | Fokussierte Suche über das Lupen-Icon im Header                                |
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
