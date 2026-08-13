# Design-Konsistenz der 4 Kernmodule (Admin)

> Snapshot vom 13.08.2026. Einmalige Analyse — wird nach der Umsetzung **nicht** gepflegt.
> Umfang: Admin-Rolle mit **nur den 4 Grundmodulen** (`members`, `trainers`, `seasons`, `finance`) plus Dashboard und Plätze (Sektion „Saison & Plätze"). Details zu optionalen Modulen bewusst ausgeklammert, sie folgen aber demselben Muster.

---

## 1. Kernbefund (TL;DR)

Die App hat bereits einen **kanonischen UI-Kit** in `components/ui/` (`PageHeader`, `StatusBadge`, `EmptyState` + Branded-Varianten, `PageError`, `Tabs`, `CenteredModal`, `LoadingButton`, `Button` mit `isLoading`, `Input` mit `variant="search"`). Das Problem ist **nicht** fehlende Komponenten, sondern dass die Kernmodul-Seiten sie **nicht durchgängig nutzen** und stattdessen eigene, leicht abweichende Kopien inline bauen.

Die Abweichungen sind einzeln klein (Padding, ein Spinner, ein Badge), summieren sich aber über jede Seite — genau das „jede Seite sieht leicht anders aus"-Gefühl.

**Wurzelursachen (2):**

1. **Doppeltes Container-Padding.** `app/(protected)/protected-client-layout.tsx` wrappt den Admin-Inhalt bereits in `p-4 md:p-6 lg:p-8 pb-20 md:pb-6` + `max-w-7xl`. Trotzdem paddn/zentrieren fast alle Seiten **selbst nochmal** (`p-4 md:p-6`, `max-w-7xl mx-auto` …). Ergebnis: unterschiedliche effektive Weißräume pro Seite.
2. **Kanonische Komponenten existieren, wurden aber nach ihrer Einführung nicht flächendeckend adoptiert.** Es gibt mehrere „Generationen" derselben Komponente nebeneinander (z. B. `page-error.tsx` UND `error-states.tsx` UND kopierte `error.tsx`; `LoadingSpinner`/`PageLoading`/`PageLoader`/`FullPageLoading` UND rohes `Loader2`). Neuere Seiten nutzen die neuen Komponenten, ältere Kernmodul-Seiten nicht.

---

## 2. Was weicht konkret voneinander ab

### 2.1 Container, Padding & Breite (höchste Sichtbarkeit)

Das Layout (`protected-client-layout.tsx`) liefert bereits: `<main class="… p-4 md:p-6 lg:p-8 pb-20 md:pb-6"><div class="mx-auto max-w-7xl">…`.

| Seite                                    | Eigenes Wrapping                                    | Effekt                                                                         |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Dashboard `(gated)/page.tsx`             | `space-y-5 sm:space-y-6 max-w-[1400px] mx-auto`     | eigene Breite 1400px statt 1280px (`max-w-7xl`) — **breiter als alle anderen** |
| Mitglieder `members-client.tsx`          | `p-4 md:p-6 space-y-4 md:space-y-6`                 | **doppeltes Padding**, kein `lg:p-8`                                           |
| Trainer `trainer-profile-management.tsx` | `p-4 md:p-8 max-w-7xl mx-auto animate-in space-y-6` | **doppeltes Padding + doppeltes `max-w-7xl`**, anderes md-Maß (`p-8`)          |
| Saisons `seasons-client.tsx`             | `space-y-6` (kein Padding)                          | korrekt — verlässt sich auf Layout                                             |
| Abrechnung `billing/page.tsx`            | `p-4 md:p-6 space-y-6`                              | **doppeltes Padding**                                                          |
| Plätze `courts/page.tsx`                 | `p-4 md:p-6 space-y-6`                              | **doppeltes Padding**                                                          |

→ **Regel:** In Admin-Seiten kein eigenes `p-*` und kein `max-w-*` mehr setzen — das Layout macht das. Nur `space-y-*` für den vertikalen Rhythmus. (Mobile: die extra Paddings treffen auf kleinen Screens am härtesten, weil dort Platz am knappsten ist.)

### 2.2 Seitenkopf (`PageHeader`) — Nutzung & Reihenfolge

`PageHeader` wird überall verwendet, aber **inkonsistent**:

| Seite      | `PageHeader`                                                                                                 | Auffälligkeit      |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| Saisons    | mit `actions`, `breadcrumbs`, `description`                                                                  | vorbildlich        |
| Abrechnung | mit `breadcrumbs`, ohne `actions`                                                                            | ok                 |
| Plätze     | nur Titel+Description, **ohne** `breadcrumbs`                                                                | abweichend         |
| Mitglieder | `PageHeader` in `members-client`, aber Aktions-Button **außerhalb** daneben gebaut statt über `actions`-Prop | doppeltes Pattern  |
| Trainer    | `PageHeader` in flex-Zeile, Buttons daneben statt `actions`                                                  | doppeltes Pattern  |
| Dashboard  | **kein** `PageHeader` (eigener `PremiumAdminHero`)                                                           | bewusst anders, ok |

Zusätzlich: **Reihenfolge Header ↔ Tabs** unterscheidet sich. Mitglieder rendert die Tab-Leiste **über** dem Titel (`members-tabs.tsx` → dann `PageHeader` in `members-client`), Abrechnung/Plätze rendern den Titel **über** den Tabs.

→ **Regel:** Ein einheitlicher Seitenkopf = `PageHeader` mit `title`, `description`, `breadcrumbs` und **alle** Aktionen über `actions`-Prop. Tabs gehören immer **unter** den Titel. Dashboard darf als Sonderfall abweichen.

### 2.3 Tabs — drei verschiedene Implementierungen

| Ort                                          | Implementierung                                        |
| -------------------------------------------- | ------------------------------------------------------ |
| Mitglieder `members-tabs.tsx`                | handgerollte `border-b-2`-Buttons (kein shadcn `Tabs`) |
| Abrechnung `billing-tabs-wrapper.tsx`        | shadcn `Tabs` mit `grid grid-cols-5`                   |
| Plätze `courts-hub-tabs.tsx`                 | shadcn `Tabs` mit dynamischem `grid-cols-{n}`          |
| Abrechnung (Sub-Filter) `billing-client.tsx` | **nochmal** handgerollte `border-b-2`-Buttons          |

→ **Regel:** shadcn `Tabs` (`components/ui/tabs.tsx`) als einzige Tab-Implementierung. Der Sub-Filter in `billing-client` ist funktional ein Filter, kein Tab — er sollte dieselbe Optik wie der Status-/Rollen-Filter der anderen Seiten bekommen (Select oder ein einheitliches `Tabs`-Muster).

### 2.4 Ladestatus — sechs+ Varianten

| Variante                                   | Wo                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| rohes `<Loader2 className="animate-spin">` | 69 Treffer, u. a. `billing-client`, `members-client`, `settings/legal-tab` |
| `LoadingSpinner`                           | `components/ui/loading-spinner.tsx`                                        |
| `PageLoading` (Shimmer-Balken)             | `courts/loading.tsx` re-exportiert es                                      |
| `PageLoader` (Overlay)                     | `loading-spinner.tsx`                                                      |
| `FullPageLoading`                          | `loading-skeletons.tsx`                                                    |
| `Skeleton`/`KPISkeleton`/`CardSkeleton`    | `skeleton.tsx`                                                             |
| handgeschriebene `loading.tsx` pro Seite   | `members`, `trainers`, `seasons` (jeweils eigene Kopie)                    |
| `TableSkeleton` (shared)                   | `billing/loading.tsx`                                                      |
| Parent `admin/loading.tsx`                 | eigenes rohes `Loader2`                                                    |

Hinzu kommt: Trainer hat **zusätzlich** einen In-Component-Loading-Skeleton (`isLoading`-State mit `Skeleton`), der sich vom Route-`loading.tsx` unterscheidet → zwei Ladeflows, die unterschiedlich aussehen.

→ **Regel:** `loading.tsx`-Dateien durchgängig auf **eine** kanonische Implementierung reduzieren (Empfehlung: `PageLoading` für ganze Seiten, `TableSkeleton`/`KPISkeletonGrid` für Tabellen/KPI). In-Component-`isLoading` durch die Skeleton-Bausteine aus `loading-skeletons.tsx` ersetzen statt eigener Hand-Skeletons.

### 2.5 Empty States — drei Stile

| Stil                          | Wo                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| gebrandet (Tennisball-Grafik) | `NoSeasonsBrandedEmptyState` (Saisons), `NoTrainersBrandedEmptyState` (Trainer)                                      |
| graues Icon (`EmptyState`)    | Mitglieder „Keine Mitglieder gefunden"                                                                               |
| handgerollt                   | Abrechnung: `DollarSign` + Text (statt vorhandenem `NoInvoicesEmptyState`); Trainer „Keine Treffer"-Card handgerollt |

Es existieren bereits **fertige** Varianten in `empty-state.tsx`, die nicht genutzt werden: `NoMembersBrandedEmptyState`, `NoInvoicesEmptyState`, `NoSearchResultsEmptyState`.

→ **Regel:** Leere Listen = Branded-Variante (`NoXxxBrandedEmptyState`), leere **Filter-Ergebnisse** = `NoSearchResultsEmptyState`/`EmptyState size="sm"`. `billing-client` auf `NoInvoicesEmptyState` umstellen; fehlende `NoInvoicesBrandedEmptyState` ergänzen.

### 2.6 Status-Badges — vier Implementierungen für dieselbe Semantik

| Implementierung                                                     | Wo                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `StatusBadge` (kanonisch, `status-badge.tsx`)                       | `trainer-billing-tab`, `absence-management`, `entity-card`                  |
| lokales `InvoiceStatusBadge`/`InvoiceTypeBadge` (handgerollte Maps) | `billing-client.tsx` (Z. 57 ff.), `members/[id]/invoices-tab.tsx`           |
| Inline-Button mit `bg-success-100 text-success-700…`                | `members-client.tsx` (Z. 496, 613) — Status **und** Aktions-Button in einem |
| `Badge` + lokale `getStatusVariant()`                               | `trainer-profile-management.tsx`                                            |

`StatusBadge` kennt die Rechnungsstatus (`paid`, `open`, `draft`, `sent`, `dunning`, `void`, …) **bereits** — die lokale `InvoiceStatusBadge` ist eine reine Duplikation. (Vorbekannt: `docs/ARCHIV/DESIGN_UNIFICATION_PROMPT.md` meldete exakt dieses Muster schon früher.)

→ **Regel:** `StatusBadge` als einzige Status-Darstellung. Interaktive Status-Toggles (Mitglieder aktiv/inaktiv) in einen Icon-Button + separates `StatusBadge` aufteilen statt eines klickbaren Farbchips.

### 2.7 Modals/Dialogs — drei Varianten

| Variante                                  | Wo                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `CenteredModal`                           | `billing-client` (Löschen, Vorschau), `trainer-profile-management`          |
| handgerolltes `fixed inset-0 bg-black/50` | `members-client.tsx` (Z. 706, 760: Bulk-Bestätigung **und** Einlade-Dialog) |
| shadcn `Dialog` / `confirm-dialog.tsx`    | vorhanden, in den Kernmodulen **ungenutzt**                                 |

→ **Regel:** `CenteredModal` (bzw. `confirm-dialog.tsx` für reine Bestätigungen) als einzige Modal-Implementierung. Die zwei handgerollten Modals in `members-client` ersetzen. Vorteil mobil: zentrierte, gescrollte, Escape-/Overlay-schließende Modals statt `fixed`-Divs.

### 2.8 Buttons mit Ladezustand — drei Varianten

| Variante                                 | Wo                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `Button isLoading` (eingebauter Spinner) | `components/ui/button.tsx` — **kaum genutzt**                            |
| `LoadingButton` (eigene Komponente)      | nur `confirm-dialog.tsx`                                                 |
| rohes `Loader2` + bedingter Text         | überall in `billing-client`, `members-client`, `fee-categories-client` … |

→ **Regel:** `Button` mit `isLoading`-Prop (kein drittes `LoadingButton`-Konzept nötig; `LoadingButton` ggf. auf `Button isLoading` zurückführen oder konsolidieren).

### 2.9 Fehlerzustände (`error.tsx`) — Shared vs. kopiert

`components/ui/page-error.tsx` (`PageError`) wird von **fast allen** Bereichen genutzt (trainer, member, tournaments, …). **Aber genau die 3 Kernmodule** `members/error.tsx`, `trainers/error.tsx`, `billing/error.tsx` sind untereinander identische **Kopien** dieser Logik statt den Shared-`PageError` zu verwenden. Zusätzlich existiert `error-states.tsx` (`QueryError`, `NotFound`, `AccessDenied`) als **zweite** Fehler-Komponenten-Familie.

→ **Regel:** `error.tsx` in den Kernmodulen auf `PageError` reduzieren (2 Zeilen). Entscheiden, ob `error-states.tsx` neben `page-error.tsx` bestehen bleiben soll (Überlappung abbauen).

### 2.10 Such-/Filterfelder — zwei Muster

| Muster                                                                            | Wo                                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `Input variant="search" leftIcon={…}`                                             | `trainer-profile-management.tsx` (korrekt, kanonisch) |
| handgerollt: `relative` + absolut positioniertes `<Search>` + `className="pl-10"` | `members-client.tsx`, `global-search.tsx`             |

→ **Regel:** `Input` mit `variant="search"`/`leftIcon` überall. (Bitte verifizieren: `members` ist Server-Side-Search mit Enter, `trainer` client-seitig debounced — funktional ok zu belassen, nur die **Optik** vereinheitlichen.)

### 2.11 Floating Bulk-Action-Bar — zwei Varianten

| Variante                                                                                        | Wo                               |
| ----------------------------------------------------------------------------------------------- | -------------------------------- |
| abgerundete **Pill** (`rounded-full`, `bg-background/95 backdrop-blur`, `slide-in-from-bottom`) | `trainer-profile-management.tsx` |
| Karte (`rounded-xl`, `bg-card`, `left-1/2 -translate-x-1/2`)                                    | `members-client.tsx`             |
| Inline-Bar im CardHeader statt floating                                                         | `billing-client.tsx`             |

→ **Regel:** **eine** Bulk-Bar (Empfehlung: die Pill-Variante der Trainer, mobil besser) als wiederverwendbare Komponente extrahieren und in `members` + `billing` verwenden.

### 2.12 KPI/Stat-Karten

- Saisons nutzt `StatCard` (`stat-card.tsx`) — korrekt.
- Dashboard `(gated)/page.tsx` baut eigene KPI-Struktur (`kpiItems` + eigenes Rendering) mit `max-w-[1400px]`.
- `loading-skeletons.tsx` und `skeleton.tsx` enthalten **beide** KPI-/Card-Skeletons (doppelte Familie).

→ **Regel:** `StatCard` auch fürs Dashboard verwenden (es unterstützt `featured`, `trend`, `badge` bereits). Skeleton-Familie konsolidieren.

---

## 3. Empfehlung: welcher Standard pro Kategorie

| Kategorie            | Kanonischer Standard                                                     | Aktion                                                                                             |
| -------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Container            | Layout macht Padding+Breite; Seiten nur `space-y-*`                      | eigenes `p-*`/`max-w-*` aus 5 Seiten entfernen                                                     |
| Seitenkopf           | `PageHeader` (`title`, `description`, `breadcrumbs`, `actions`)          | Mitglieder/Trainer auf `actions`-Prop umstellen; Plätze Breadcrumbs ergänzen; Tabs unter den Titel |
| Tabs                 | shadcn `Tabs`                                                            | `members-tabs` umstellen; `billing-client`-Subfilter angleichen                                    |
| Laden (Route)        | `PageLoading` (Seiten) / `TableSkeleton`, `KPISkeletonGrid` (Listen/KPI) | 4 handgeschriebene `loading.tsx` ersetzen; `admin/loading.tsx` angleichen                          |
| Laden (in Component) | Skeleton-Bausteine aus `loading-skeletons.tsx`                           | Trainer-In-Component-Skeleton vereinheitlichen                                                     |
| Empty State          | Branded für leere Liste, `EmptyState sm` für Filter-Empty                | `billing` → `NoInvoices…`, Mitglieder-Filter-Empty angleichen                                      |
| Status               | `StatusBadge`                                                            | `InvoiceStatusBadge`/`InvoiceTypeBadge`/Inline-Chips entfernen                                     |
| Modal                | `CenteredModal` / `confirm-dialog`                                       | 2 handgerollte Modals in `members-client` ersetzen                                                 |
| Button-Loading       | `Button isLoading`                                                       | rohes `Loader2` in Buttons ersetzen; `LoadingButton` konsolidieren                                 |
| Fehler               | `PageError`                                                              | `members`/`trainers`/`billing` `error.tsx` auf Shared-Komponente reduzieren                        |
| Suche                | `Input variant="search"`                                                 | `members-client`-Suche umstellen                                                                   |
| Bulk-Bar             | eine wiederverwendbare Pill-Bar                                          | aus Trainer extrahieren, in `members`+`billing` nutzen                                             |
| KPI                  | `StatCard`                                                               | Dashboard auf `StatCard` umstellen                                                                 |

---

## 4. Vorgehen (Reihenfolge, mobil-freundlich)

1. **Zuerst die Container-/Padding-Fixes** (2.1) — größter sichtbarer Effekt, geringes Risiko, sofort ein einheitlicher Grundriss. Mobile zuerst prüfen (weniger Platz ⇒ doppeltes Padding schmerzt am meisten).
2. **Komponenten-Konsolidierung** (2.6, 2.9, 2.8, 2.7): Duplikate löschen statt umbauen — `InvoiceStatusBadge` → `StatusBadge`, kopierte `error.tsx` → `PageError`, `Loader2`-Buttons → `Button isLoading`, handgerollte Modals → `CenteredModal`.
3. **Tab-/Kopf-Normalisierung** (2.2, 2.3): ein Header-Muster, ein Tabs-Muster.
4. **Loading/Empty-Normalisierung** (2.4, 2.5): eine Route-Loading-Variante, ein Empty-State-Stil.
5. **Bulk-Bar extrahieren** (2.11) als letzter, weil es eine neue gemeinsame Komponente braucht.

**Verifikation:** `npx tsc --noEmit`, `npx vitest run`, dann Sichtprüfung je Kernmodul in Light+Dark und auf schmaler Viewport-Breite (`< 768px`, da mobile Nutzung wichtig ist).

---

## 5. Anhang: konkrete Datei-Referenzen

- Layout/Container: `app/(protected)/protected-client-layout.tsx` (Admin-`<main>`), `app/(protected)/admin/loading.tsx`
- Kernmodule Seiten: `app/(protected)/admin/(gated)/{members,trainers,seasons,billing,courts}/…`
- Kanonische Komponenten: `components/ui/{page-header,status-badge,empty-state,page-error,error-states,tabs,centered-modal,confirm-dialog,loading-button,loading-spinner,loading-skeletons,skeleton,stat-card,button,input}.tsx`
- Vorbekanntes gleiches Muster: `docs/ARCHIV/DESIGN_UNIFICATION_PROMPT.md` (StatusBadge/Farbchips), `docs/ARCHIV/TSOWAPP_UX_VERGLEICH.md` (Z. 229, 262)
