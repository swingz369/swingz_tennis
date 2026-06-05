# 🎾 SwingZ Design Audit — 2026-06-05

> Comprehensive audit of all pages, components, and routes for design consistency.

---

## Summary

| Category                       | Issues Found                                               | Severity  |
| ------------------------------ | ---------------------------------------------------------- | --------- |
| Hardcoded Gray Colors          | **286+** instances (`bg-gray-*`, `text-gray-*`)            | 🔴 High   |
| Inconsistent Border Radius     | Mixed `rounded-md`/`rounded-lg`/`rounded-xl`/`rounded-2xl` | 🟡 Medium |
| Inconsistent Shadow Usage      | Mixed `shadow-sm`/`shadow-md`/`shadow-lg`/`shadow-2xl`     | 🟡 Medium |
| Error Pages Using Wrong Colors | `blue-600`, `yellow-50` instead of brand colors            | 🔴 High   |
| Hardcoded `bg-white`           | Should use `bg-surface` / `bg-background` token            | 🟡 Medium |
| Missing Dark Mode Classes      | Some components lack `dark:` variants                      | 🟡 Medium |
| Font Weight Inconsistency      | Mixed `font-medium`/`font-semibold`/`font-bold` usage      | 🟢 Low    |

---

## 1. Hardcoded Gray Colors (Critical)

### Problem

286+ instances of hardcoded `bg-gray-*` and `text-gray-*` across 40+ files instead of using design tokens.

### Design Token Mapping

| Current Usage      | Should Be                           | Token   |
| ------------------ | ----------------------------------- | ------- |
| `bg-gray-50`       | `bg-muted` or `bg-brand-primary/5`  | Surface |
| `bg-gray-100`      | `bg-muted` or `bg-brand-primary/10` | Surface |
| `bg-gray-200`      | `border-border`                     | Border  |
| `text-gray-400`    | `text-muted-foreground`             | Text    |
| `text-gray-500`    | `text-muted-foreground`             | Text    |
| `text-gray-600`    | `text-secondary-foreground`         | Text    |
| `text-gray-700`    | `text-foreground`                   | Text    |
| `text-gray-900`    | `text-foreground`                   | Text    |
| `border-gray-200`  | `border-border`                     | Border  |
| `dark:bg-gray-800` | `dark:bg-muted`                     | Surface |
| `dark:bg-gray-900` | `dark:bg-card`                      | Surface |

### Affected Files (Top 15)

1. `components/trainer-profile-management.tsx` — 25+ instances
2. `components/ai/matchmaking-panel.tsx` — 20+ instances
3. `components/season-plan-grid.tsx` — 15+ instances
4. `components/notification-settings.tsx` — 12+ instances
5. `components/member-training-schedule.tsx` — 10+ instances
6. `components/member-billing.tsx` — 10+ instances
7. `components/member-court-bookings.tsx` — 10+ instances
8. `components/layout/sidebar.tsx` — 10+ instances
9. `app/(protected)/meine-bestellungen/page.tsx` — 8+ instances
10. `components/ai/churn-risk-panel.tsx` — 6+ instances
11. `components/court-calendar-shared.tsx` — 6+ instances
12. `components/admin-trial-approvals.tsx` — 6+ instances
13. `app/(protected)/trainer/page.tsx` — 8+ instances
14. `components/layout/header.tsx` — 6+ instances
15. `components/gamification-dashboard.tsx` — 5+ instances

---

## 2. Error Pages — Wrong Color Palette

### Problem

Error pages use `blue-600`/`blue-700` for buttons instead of brand colors.

### Affected Files

| File                                | Issue                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `app/error.tsx`                     | Uses `bg-blue-600 hover:bg-blue-700 ring-blue-500` — should use `bg-brand-primary` |
| `app/(protected)/trainer/error.tsx` | Uses `bg-blue-600 hover:bg-blue-700` — should use `bg-brand-primary`               |

### Fix

Replace `blue-*` with brand colors:

```
bg-blue-600 → bg-brand-primary
bg-blue-700 → hover:bg-brand-primary/90
ring-blue-500 → ring-brand-light
```

---

## 3. Border Radius Inconsistency

### Problem

The design system specifies `rounded-xl` for buttons, `rounded-2xl` for cards, `rounded-xl` for inputs. But the codebase mixes:

- `rounded-md` (6px) — used in shadcn defaults, toast, dropdown
- `rounded-lg` (8px) — used in some cards, legacy components
- `rounded-xl` (16px) — correct for buttons/inputs per design tokens
- `rounded-2xl` (24px) — correct for cards per design tokens
- `rounded-3xl` (32px) — used in about/contact pages

### Recommendation

- **UI primitives** (`button.tsx`, `input.tsx`, `card.tsx`) already follow tokens ✅
- **Page-level components** need migration from `rounded-lg` → `rounded-xl`/`rounded-2xl`
- **shadcn defaults** (dropdown, toast, dialog) keep `rounded-md` — this is acceptable for small overlays

---

## 4. Shadow Inconsistency

### Problem

The design system defines a clear shadow hierarchy but components use arbitrary shadows:

| Design Token | Usage          | Current Code                       |
| ------------ | -------------- | ---------------------------------- |
| `shadow-sm`  | Cards default  | ✅ Widely used                     |
| `shadow-md`  | Elevated cards | ✅ Used for hover states           |
| `shadow-lg`  | Modals         | Mixed with `shadow-2xl` for modals |
| `shadow-2xl` | Hero elements  | Used inconsistently for modals too |

### Specific Issues

- Some modals use `shadow-2xl` (correct for hero/modals), others use `shadow-lg`
- `shadow-xl` is used in some places but not defined in the token system
- Glow shadows (`shadow-glow-primary`, `shadow-glow-accent`) are defined but barely used

---

## 5. `bg-white` vs Design Tokens

### Problem

Many components use `bg-white` directly instead of `bg-surface` or `bg-background`.

### Affected Pattern

```tsx
// Current (hardcoded)
<div className="bg-white dark:bg-surface-dark">

// Should be
<div className="bg-background dark:bg-surface-dark">
```

This affects ~50+ instances across the codebase. The `bg-background` token maps to `--background` CSS variable which is `0 0% 100%` in light mode and `150 20% 8%` in dark mode.

---

## 6. Dark Mode Gaps

### Problem

Some components have inconsistent dark mode treatment:

| Component                              | Issue                                              |
| -------------------------------------- | -------------------------------------------------- |
| `app/(protected)/trainer/error.tsx`    | No `dark:` variants at all                         |
| `app/error.tsx`                        | Uses `dark:bg-gray-800` instead of semantic tokens |
| `components/court-calendar-shared.tsx` | Missing dark mode for calendar cells               |
| `components/daily-court-view.tsx`      | Partial dark mode                                  |
| `app/offline/page.tsx`                 | No dark mode classes                               |

---

## 7. Page-by-Page Audit

### Public Pages

| Page              | Design Score | Issues                                        |
| ----------------- | ------------ | --------------------------------------------- |
| `/` (root)        | ✅ Clean     | Redirects properly                            |
| `/landing`        | ✅ 9/10      | Excellent use of brand, gradients, animations |
| `/login`          | ✅ 8/10      | Good brand usage, minor gray-hardcode         |
| `/about`          | ✅ 8/10      | Good brand consistency                        |
| `/contact`        | ✅ 8/10      | Good, uses brand tokens                       |
| `/apply`          | ✅ 8/10      | Clean form design                             |
| `/offline`        | 🟡 6/10      | No dark mode, uses `bg-brand` (undefined)     |
| `/trial-training` | ✅ 8/10      | Clean public booking form                     |
| `/register`       | ✅ 8/10      | Consistent with brand                         |
| `/sepa-mandate`   | 🟡 6/10      | Uses `bg-white`, `text-gray-600`              |
| `/design-preview` | ✅ 9/10      | Self-documenting, comprehensive               |

### Member Pages

| Page                      | Design Score | Issues                             |
| ------------------------- | ------------ | ---------------------------------- |
| `/member` (dashboard)     | ✅ 8/10      | Good brand usage                   |
| `/member/profile`         | 🟡 7/10      | `bg-gray-200` avatar placeholder   |
| `/member/preferences`     | ✅ 8/10      | Clean form                         |
| `/member/trainer-booking` | ✅ 8/10      | Good                               |
| `/member/tournaments`     | ✅ 8/10      | Good                               |
| `/bookings`               | 🟡 7/10      | Mixed gray usage                   |
| `/my-bookings`            | 🟡 7/10      | Mixed gray usage                   |
| `/billing`                | 🟡 7/10      | `text-gray-600` hardcoded          |
| `/shop`                   | ✅ 8/10      | Good brand usage                   |
| `/notifications`          | 🟡 7/10      | Multiple `bg-gray-50` instances    |
| `/search`                 | 🟡 7/10      | `bg-white` hardcoded               |
| `/news`                   | ✅ 8/10      | Good brand usage                   |
| `/gamification`           | 🟡 7/10      | Mixed gray usage                   |
| `/scheduler`              | 🟡 7/10      | `bg-gray-50`, `bg-white` hardcoded |
| `/training-schedule`      | ✅ 8/10      | Good                               |
| `/attendance-history`     | ✅ 8/10      | Good brand usage                   |

### Trainer Pages

| Page                    | Design Score | Issues                           |
| ----------------------- | ------------ | -------------------------------- |
| `/trainer` (dashboard)  | ✅ 9/10      | Excellent brand usage, gradients |
| `/trainer/availability` | 🟡 7/10      | `text-gray-400` hardcoded        |
| `/trainer/hours-logs`   | 🟡 7/10      | `bg-gray-100`, `text-gray-400`   |

### Admin Pages

| Page                    | Design Score | Issues                               |
| ----------------------- | ------------ | ------------------------------------ |
| `/admin` (dashboard)    | ✅ 9/10      | Excellent, gradients, KPIs           |
| `/admin/onboarding`     | 🟡 7/10      | `bg-gray-200` progress, `bg-gray-50` |
| `/admin/members`        | ✅ 8/10      | Good                                 |
| `/admin/members/[id]`   | ✅ 8/10      | Good                                 |
| `/admin/courts`         | ✅ 8/10      | Good                                 |
| `/admin/billing`        | ✅ 8/10      | Good                                 |
| `/admin/seasons`        | ✅ 8/10      | Good                                 |
| `/admin/seasons/[id]`   | 🟡 7/10      | Some gray-hardcode                   |
| `/admin/tournaments`    | ✅ 8/10      | Good                                 |
| `/admin/settings`       | 🟡 7/10      | `bg-gray-100` tabs                   |
| `/admin/shop`           | 🟡 7/10      | `bg-gray-100` tabs                   |
| `/admin/analytics`      | ✅ 8/10      | Good                                 |
| `/admin/approvals`      | ✅ 8/10      | Good                                 |
| `/admin/trial-training` | ✅ 8/10      | Good                                 |
| `/admin/trainers`       | ✅ 8/10      | Good                                 |
| `/admin/ai/matchmaking` | 🟡 6/10      | Heavy `bg-gray-*` usage              |

### Error Pages

| Page                                | Design Score | Issues                                     |
| ----------------------------------- | ------------ | ------------------------------------------ |
| `app/error.tsx`                     | 🔴 4/10      | Blue buttons, gray-hardcode, no brand      |
| `app/global-error.tsx`              | 🟡 6/10      | Uses `destructive` token (OK) but no brand |
| `app/(protected)/trainer/error.tsx` | 🔴 4/10      | Blue buttons, no dark mode                 |
| `app/(protected)/admin/error.tsx`   | 🟡 6/10      | `bg-white` hardcoded                       |

---

## 8. Component-Level Audit

### Layout Components

| Component               | Score   | Issues                                   |
| ----------------------- | ------- | ---------------------------------------- |
| `sidebar.tsx`           | ✅ 8/10 | Good brand usage, some `bg-gray-50`      |
| `mobile-bottom-nav.tsx` | ✅ 9/10 | Excellent brand consistency              |
| `header.tsx`            | ✅ 8/10 | Good glass-morphism                      |
| `admin-section.tsx`     | 🟡 7/10 | `bg-gray-50` in section headers          |
| `global-search.tsx`     | 🟡 6/10 | `bg-white` hardcoded, `bg-gray-50` hover |

### UI Primitives (`components/ui/`)

| Component         | Score   | Notes                         |
| ----------------- | ------- | ----------------------------- |
| `button.tsx`      | ✅ 9/10 | Excellent, follows tokens     |
| `card.tsx`        | ✅ 9/10 | Good shadow/radius tokens     |
| `input.tsx`       | ✅ 9/10 | Good brand focus ring         |
| `dialog.tsx`      | ✅ 8/10 | Standard shadcn               |
| `badge.tsx`       | ✅ 8/10 | Good                          |
| `data-table.tsx`  | 🟡 7/10 | `bg-white`, `border-gray-200` |
| `stat-card.tsx`   | 🟡 7/10 | `border-gray-200` hardcoded   |
| `empty-state.tsx` | ✅ 8/10 | Good                          |
| `page-header.tsx` | ✅ 9/10 | Excellent brand usage         |

---

## 9. Recommended Actions

### Priority 1 — Quick Wins (1-2 hours)

1. Fix error pages (`app/error.tsx`, `trainer/error.tsx`) to use brand colors
2. Fix `app/offline/page.tsx` dark mode
3. Replace `bg-brand` (undefined) with `bg-brand-primary` in offline page

### Priority 2 — Systematic Migration (4-6 hours)

4. Create a codemod or find-and-replace to migrate `bg-gray-*` → semantic tokens
5. Migrate `text-gray-*` → `text-muted-foreground` / `text-foreground`
6. Migrate `bg-white` → `bg-background` where appropriate

### Priority 3 — Polish (2-3 hours)

7. Add dark mode to `court-calendar-shared.tsx`, `daily-court-view.tsx`
8. Standardize border radius on page-level components
9. Use glow shadows more consistently on CTAs

---

_Audit performed on 2026-06-05 by automated analysis of 80+ pages and 60+ components._
