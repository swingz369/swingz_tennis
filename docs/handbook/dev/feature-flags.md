# Feature-Flags — `clubs.features` JSONB

> **Source of Truth:** [`lib/features.ts`](../../../lib/features.ts) ist die kanonische Registry.
> **Spalte:** [`clubs.features`](../../../src/infrastructure/persistence/schema.ts) (JSONB in Tabelle `clubs`).
>
> **Stand:** aus dem tatsächlichen Code abgeleitet — Datum des letzten Reads im Commit-Hash. Bei Code-Änderungen an `CLUB_FEATURES` MUSS dieses Kapitel mitgezogen werden.

---

## Datenbank-Spalte

Definition aus `src/infrastructure/persistence/schema.ts`:

```ts
// src/infrastructure/persistence/schema.ts:80-95
features: jsonb('features').$type<Record<string, boolean>>().notNull().default({
  members: true,             // CORE — unveränderlich
  trainers: true,            // CORE — unveränderlich
  seasons: true,             // CORE — unveränderlich
  finance: true,             // CORE — unveränderlich
  shop: false,
  tournaments: false,
  trial_training: false,
  ai_matchmaking: false,
  weather_integration: false,
  league_lineup: false,
  work_duty: false,
  dynamic_pricing: false,
}),
```

Die 13 Schlüssel müssen exakt der `CLUB_FEATURES`-Liste in `lib/features.ts` entsprechen.

---

## Modul-Registry (13 Module, verbatim aus `lib/features.ts:21-138`)

### Core (4 — immer aktiv, nicht togglebar)

| #   | Key        | Label                | Beschreibung (de, verbatim)                                     | Icon            | Sidebar-Section |
| --- | ---------- | -------------------- | --------------------------------------------------------------- | --------------- | --------------- |
| 1   | `members`  | Mitgliederverwaltung | Verwalte Mitglieder, Einladungen, Genehmigungen und Stammdaten. | `Users`         | `members`       |
| 2   | `trainers` | Trainer              | Trainerprofile, Verfügbarkeiten und Stundenerfassung.           | `GraduationCap` | `trainers`      |
| 3   | `seasons`  | Saisonplanung        | Saisonen, KI-Clustering und Stundenpläne für Trainingsgruppen.  | `CalendarDays`  | `seasons`       |
| 4   | `finance`  | Finanzen             | Abrechnung, Beitragskategorien, Rechnungen und Mahnwesen.       | `DollarSign`    | `finance`       |

### Optional (9 — togglebar über `useClubFeatures` Hook + Settings)

| #   | Key                   | Label                      | Beschreibung (de, verbatim)                                                                     | Icon           | Sidebar-Section       | Notes                         |
| --- | --------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- | -------------- | --------------------- | ----------------------------- |
| 5   | `shop`                | Shop                       | Verkauf von Vereinsartikeln, Bällen und Zubehör direkt an Mitglieder.                           | `ShoppingBag`  | `shop`                | —                             |
| 6   | `tournaments`         | Turniere                   | Organisation von Vereinsturnieren, Anmeldungen und Spielplänen.                                 | `Trophy`       | `tournaments`         | —                             |
| 7   | `trial_training`      | Probetrainings             | Online-Anmeldeformular und Verwaltung von Schnupperstunden.                                     | `FlaskConical` | `trial_training`      | öffentlich zugänglich         |
| 8   | `ai_matchmaking`      | KI-Matchmaking             | Spielpartner-Matching auf Basis von Niveau und Verfügbarkeit.                                   | `Sparkles`     | `ai_matchmaking`      | Cost-Passthrough per ADR-003  |
| 9   | `weather_integration` | Wetter-Integration         | Automatische Platzsperren bei Regen und Schlechtwetter.                                         | `CloudRain`    | `weather_integration` | —                             |
| 10  | `league_lineup`       | Liga & Mannschaft          | Mannschaftsaufstellung, Liga-Verwaltung und Spieltag-Planung.                                   | `Flag`         | `league_lineup`       | —                             |
| 11  | `work_duty`           | Arbeitsdienst              | Gemeinschaftsdienst-Verwaltung mit Zuweisung und Nachverfolgung.                                | `HardHat`      | `work_duty`           | —                             |
| 12  | `smart_court`         | Smart Court                | Automatische Platzkontrolle via Hardware-Integration (Nuki, Shelly, Loxone). Add-On € 79/Monat. | `Wifi`         | `smart_court`         | **separates Add-On** (Tier-3) |
| 13  | `dynamic_pricing`     | Dynamische Preisgestaltung | Zeitbasierte Preise für Plätze: Peak/Off-Peak, Tagespreise und Saison-Aufschläge.               | `TrendingUp`   | `pricing`             | —                             |

**Comment im Code** (lib/features.ts:111):

> _ponytail: add-on priced separately (€79/Monat) — gates hardware vendor access from 3.1.x_

Dies bezieht sich auf `smart_court` — es ist NICHT in `lib/hooks/use-club-features.ts` einfach togglebar, sondern ein **Tier-gating** (Lib `tier-features-sync` + Stripe-Webhook ADR-003).

---

## Helpers (verfügbar via ESM-Import `from '@/lib/features'`)

| Export                               | Signatur (verbatim)                                                              | Zweck                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `CLUB_FEATURES`                      | `readonly ClubFeature[]`                                                         | Master-Liste, sortiert nach `order`                                   |
| `CORE_FEATURE_KEYS`                  | `readonly FeatureKey[]`                                                          | `'members' \| 'trainers' \| 'seasons' \| 'finance'`                   |
| `OPTIONAL_FEATURE_KEYS`              | `readonly FeatureKey[]`                                                          | alle 9 optionalen Keys                                                |
| `ALL_FEATURE_KEYS`                   | `readonly FeatureKey[]`                                                          | alle 13                                                               |
| `getDefaultFeatures()`               | `() => Record<string, boolean>`                                                  | Defaults: core=true, optional=false                                   |
| `sanitizeFeatureFlags(raw)`          | `(raw: Record<string, unknown> \| null \| undefined) => Record<string, boolean>` | Validiert DB-Wert; erzwingt Core-Immutability + Dependency-Resolution |
| `getFeature(key)`                    | `(key: string) => ClubFeature \| undefined`                                      | Lookup mit `key`                                                      |
| `getHiddenSidebarSections(features)` | `(features) => Set<string>`                                                      | Welche Sidebar-Sektionen sind versteckt                               |

---

## Sanitize — was passiert intern

`sanitizeFeatureFlags` aus `lib/features.ts:178-200` macht drei Dinge:

1. **Defaults anwenden** — wenn `raw=null` oder `typeof raw !== 'object'` → `getDefaultFeatures()`
2. **Validierte Keys übernehmen** — nur Keys aus `ALL_FEATURE_KEYS`, nur Boolean-Werte
3. **Core-Immunity** — `for (key of CORE_FEATURE_KEYS) defaults[key] = true`
4. **Dependency-Cascade** — wenn `key.dependsOn` definiert ist und parent nicht aktiv: `key` automatisch auf `false`

⚠️ **`dependsOn` aktuell**: Keines der 13 Features hat aktuell ein `dependsOn` definiert (lib/features.ts:21-138 zeigt keins). Die Cascade-Logik ist vorbereitet, aber nicht aktiv genutzt.

---

## `useClubFeatures` Hook

Datei: [`hooks/use-club-features.ts`](../../../hooks/use-club-features.ts)

- **Optimistic Update + AbortController** für Toggle-Requests
- Quelle: `import { useClubFeatures } from '@/hooks/use-club-features';`
- Liest initial aus `GET /api/clubs/[id]/features`, mutations `PATCH /api/clubs/[id]/features`

---

## Endpoint

[`app/api/clubs/[id]/features/route.ts`](../../../app/api/clubs/[id]/features/route.ts):

- **GET** — liest `clubs.features` aus DB, gibt `sanitizeFeatureFlags(data.features)` zurück
- **PATCH** — validiert Body mit Zod, schreibt `sanitizeFeatureFlags(parsed.data)` shallow-merge zurück

---

## Beispiele aus dem Code

### Client-Side-Toggle

```tsx
// components/onboarding/module-selection-step.tsx:99
const saved = sanitizeFeatureFlags(data?.features);
```

### Dynamic-Pricing-Gate

```ts
// app/api/bookings/route.ts (siehe q2.0.4-Patch-Doku):
if (!features.dynamic_pricing) return standardPrice;
```

### Hardware-Vendor (Smart-Court-Tier)

```ts
// app/api/clubs/[id]/hardware-vendor/route.ts — shallow-JSONB-Merge:
{...existingFeatures, hardware_vendor: newVendor}
```

---

## Tests

[`src/__tests__/lib/features.test.ts`](../../../src/__tests__/lib/features.test.ts) — 7+ Vitest-Cases:

- Core-Immunity (4 Tests)
- Sanitize von `null` / `undefined` / Non-Object / Wrong-Type Werten
- Always-Force-Core-True
- Dependency-Cascade (vorbereitet)

---

## ⚠️ Bekannte Limitierungen (aus dem Code ableitbar)

1. **`useClubFeatures`-API-Toggle-UI aktuell nur für `dynamic_pricing`** (siehe `app/(protected)/admin/(gated)/pricing/`) — die anderen 8 optionalen Features haben KEIN dediziertes Toggle-UI, nur globale Onboarding-Wizard-Auswahl.
2. **`dependsOn` nicht aktiv** — kein Single-Feature hat aktuell eine Abhängigkeit definiert (Platzhalter-Logik in `sanitizeFeatureFlags` ist tot).
3. **Owner-handling**: `clubs.features` ist per-Club; Owner-Accounts haben kein Club-Binding. Siehe [`lib/auth-common.ts`](../../../lib/auth-common.ts) und eigenes Owner-Kapitel.

---

## 📚 Verwandte Kapitel

- [`data-model.md`](./data-model.md) — JSONB-Spalte `clubs.features`
- [`../user/owner.md`](../user/owner.md) — Plattformbetreiber-Sicht
- [`../user/admin.md`](../user/admin.md) — Vereinsadmin-Toggles
