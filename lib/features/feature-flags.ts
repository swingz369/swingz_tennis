/**
 * Feature flags — all services permanently switched to Drizzle repositories.
 *
 * Since the DB tables are now fully migrated (incl. club_id multi-club scope),
 * all feature flags are hardcoded to `true`. The legacy in-memory implementations
 * remain available for integration tests via `vi.mock`.
 */

export const FeatureFlags = {
  USE_BILLING_REPOSITORY: true,
  USE_COURSE_REPOSITORY: true,
  USE_ATTENDANCE_REPOSITORY: true,
  USE_MEMBER_REPOSITORY: true,
  USE_TRAINER_REPOSITORY: true,
  USE_ABSENCE_REPOSITORY: true,
  USE_FEE_CONFIGURATION_REPOSITORY: true,
  USE_PAYMENT_SETTINGS_REPOSITORY: true,
  USE_SYSTEM_SETTINGS_REPOSITORY: true,
  USE_TRIAL_TRAINING_REPOSITORY: true,
  USE_TRAINER_PROFILE_REPOSITORY: true,
  USE_HOURLY_RATE_REPOSITORY: true,
  USE_SEPA_MANDATE_REPOSITORY: true,
} as const;

/**
 * Check if a specific feature flag is enabled
 */
export function isFeatureEnabled(flag: keyof typeof FeatureFlags): boolean {
  return FeatureFlags[flag];
}

/**
 * Get all enabled feature flags
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FeatureFlags)
    .filter(([_, enabled]) => enabled)
    .map(([flag]) => flag);
}

/**
 * Development helper: Log feature flag status (all permanently enabled)
 */
export function logFeatureFlags(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Feature Flags] All Drizzle repositories permanently enabled ✅');
  }
}
