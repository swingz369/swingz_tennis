---
name: swingz-feature-flags
description: SwingZ-specific knowledge for the per-club feature flag system — JSONB config, immutability rules, gating logic, and how to add new flags safely.
---

# SwingZ Feature Flags

## Where it lives

- **Type definition:** `lib/features.ts` (TypeScript types + `ALL_FEATURES` constant)
- **DB column:** `clubs.features` (jsonb, default `{}`) in `src/infrastructure/persistence/schema.ts`
- **Helper:** `lib/club-features.ts` (server-side getter with caching)
- **Client helper:** `lib/client-features.ts` (read-only from cookies, for fast initial render)
- **API:** `app/api/clubs/[id]/features/route.ts` (GET, PUT — club admin only)
- **Onboarding:** `components/onboarding/module-selection-step.tsx` (where user picks features at signup)
- **Gating:** `lib/feature-gate.tsx` (React component for conditional rendering)

## Architecture: Per-Club JSONB

**We don't use a `feature_flags` table.** Each club has a `features` jsonb column with the format:

```typescript
type ClubFeatures = {
  members: boolean; // always true (core, immutable)
  trainers: boolean; // always true (core, immutable)
  finances: boolean; // billing/invoicing module
  season_planning: boolean; // Saisonplanung wizard
  shop: boolean; // merchandise shop
  tournaments: boolean; // tournament management
  trial_trainings: boolean; // Probetraining flow
  ai_matchmaking: boolean; // AI-based group matching
};
```

## Core features are IMMUTABLE

```typescript
const CORE_FEATURES = ['members', 'trainers'] as const;
```

These are set `true` at club creation and can NEVER be disabled. The API rejects PUT requests that try to set them to `false`. This prevents billing/support nightmares.

## Gating patterns

### Server-side (preferred)

```typescript
// In API route or server component
import { getClubFeatures } from '@/lib/club-features';
const features = await getClubFeatures(clubId);
if (!features.season_planning) {
  return NextResponse.json({ error: 'feature_disabled' }, { status: 403 });
}
```

### Client-side (for UI hints only)

```typescript
// In a React component
import { useFeatureFlag } from '@/lib/feature-gate';
const hasShop = useFeatureFlag('shop');
if (!hasShop) return null; // hide the shop nav item
```

**Never** use client-side gating for security — the API must re-check server-side.

## Adding a new feature flag

1. **Add to `lib/features.ts`:**

   ```typescript
   export const ALL_FEATURES = [
     'members',
     'trainers',
     'finances',
     'season_planning',
     'shop',
     'tournaments',
     'trial_trainings',
     'ai_matchmaking',
     'new_feature_name', // ← add here
   ] as const;

   export type FeatureName = (typeof ALL_FEATURES)[number];

   export type ClubFeatures = Record<FeatureName, boolean>;
   ```

2. **Add to default features in onboarding:** `components/onboarding/module-selection-step.tsx`
   - Add card to the grid
   - Add to default `selectedFeatures` Set
   - Add pricing tier requirement (if applicable)

3. **Add to API PUT whitelist:** `app/api/clubs/[id]/features/route.ts`

   ```typescript
   const ALLOWED_FEATURES = ALL_FEATURES; // or a subset
   const sanitized = pick(input, ALLOWED_FEATURES);
   ```

4. **Add gating wherever the feature is used:**

   ```typescript
   if (!features.new_feature_name) return <UpgradePrompt feature="new_feature_name" />;
   ```

5. **Update `VERKAUFSBEREITSCHAFT.md`** pricing table if it's a paid feature

6. **Add E2E test:** Enable the flag, verify UI shows; disable it, verify UI hides

## Migration / backfill

When adding a flag that should be ON for existing clubs:

```sql
-- supabase/migrations/YYYYMMDD_enable_new_feature_for_all.sql
UPDATE clubs
SET features = features || '{"new_feature_name": true}'::jsonb
WHERE NOT (features ? 'new_feature_name');
```

For features that should be OFF (opt-in):

```sql
UPDATE clubs
SET features = features || '{"new_feature_name": false}'::jsonb
WHERE NOT (features ? 'new_feature_name');
```

## Pricing tier gating

Some features require a specific plan. Check in `lib/billing/`:

```typescript
// In API route
const subscription = await getSubscription(clubId);
if (features.season_planning && subscription.tier === 'free') {
  return NextResponse.json(
    {
      error: 'upgrade_required',
      feature: 'season_planning',
      requiredTier: 'pro',
    },
    { status: 402 }
  );
}
```

## Common tasks

### Check if a feature is enabled for current club

```typescript
import { getClubFeatures } from '@/lib/club-features';
const features = await getClubFeatures(clubId);
const isEnabled = features.ai_matchmaking === true;
```

### Add a feature that depends on another

```typescript
// In lib/features.ts
export const FEATURE_DEPENDENCIES: Partial<Record<FeatureName, FeatureName[]>> = {
  ai_matchmaking: ['season_planning'], // AI requires season planning
  shop: ['finances'], // Shop requires billing
};
// Enforce in API PUT handler
```

### Audit which clubs have which features

```sql
SELECT
  features->>'ai_matchmaking' AS ai_matchmaking_enabled,
  COUNT(*) AS club_count
FROM clubs
WHERE features ? 'ai_matchmaking'
GROUP BY features->>'ai_matchmaking';
```

## Gotchas

- **JSONB merge behavior:** `features || '{"new": true}'::jsonb` only ADDS, doesn't overwrite existing `false`. Use `jsonb_set()` to force overwrite.
- **Null safety:** Old clubs may have `features = NULL` or `{}`. Always coalesce: `features || '{}'::jsonb`.
- **Cookie vs DB sync:** Client-side `useFeatureFlag` reads from a cookie set at login. If admin changes a feature flag, the user must refresh (or the cookie must be updated via API call).
- **Naming:** Use snake_case in the JSONB keys (Postgres convention), camelCase in TypeScript. The `getClubFeatures()` helper does the conversion.
- **Type safety:** `ClubFeatures` is a `Record<FeatureName, boolean>` — adding to `ALL_FEATURES` without updating `ClubFeatures` will cause a TypeScript error (good!).
