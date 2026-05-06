/**
 * Feature flags for gradual service migration rollout
 *
 * Set environment variables to enable:
 * - USE_BILLING_REPOSITORY=true
 * - USE_COURSE_REPOSITORY=true
 * - USE_ATTENDANCE_REPOSITORY=true
 * - USE_MEMBER_REPOSITORY=true
 * - USE_TRAINER_REPOSITORY=true
 * - USE_ABSENCE_REPOSITORY=true
 * - USE_FEE_CONFIGURATION_REPOSITORY=true
 * - USE_PAYMENT_SETTINGS_REPOSITORY=true
 * - USE_SYSTEM_SETTINGS_REPOSITORY=true
 * - USE_TRIAL_TRAINING_REPOSITORY=true
 * - USE_TRAINER_PROFILE_REPOSITORY=true
 * - USE_HOURLY_RATE_REPOSITORY=true
 * - USE_SEPA_MANDATE_REPOSITORY=true
 */

export const FeatureFlags = {
  /**
   * Enable Billing Service repository pattern (BillingPeriod, TrainerBilling, BillingLineItem)
   *
   * When enabled: Uses Drizzle repositories instead of in-memory arrays
   * Default: false (uses in-memory for backward compatibility)
   */
  USE_BILLING_REPOSITORY: process.env.USE_BILLING_REPOSITORY === 'true',

  /**
   * Enable Course Service repository pattern
   *
   * When enabled: Uses CourseRepository instead of in-memory arrays
   * Default: false
   */
  USE_COURSE_REPOSITORY: process.env.USE_COURSE_REPOSITORY === 'true',

  /**
   * Enable Attendance Service repository pattern
   *
   * When enabled: Uses AttendanceRepository instead of in-memory arrays
   * Default: false
   */
  USE_ATTENDANCE_REPOSITORY: process.env.USE_ATTENDANCE_REPOSITORY === 'true',

  /**
   * Enable Member Service repository pattern
   *
   * When enabled: Uses MemberRepository instead of in-memory arrays
   * Default: false
   */
  USE_MEMBER_REPOSITORY: process.env.USE_MEMBER_REPOSITORY === 'true',

  /**
   * Enable Trainer Service repository pattern
   *
   * When enabled: Uses TrainerRepository instead of in-memory arrays
   * Default: false
   */
  USE_TRAINER_REPOSITORY: process.env.USE_TRAINER_REPOSITORY === 'true',

  /**
   * Enable Absence Service repository pattern
   *
   * When enabled: Uses AbsenceRepository instead of in-memory arrays
   * Default: false
   */
  USE_ABSENCE_REPOSITORY: process.env.USE_ABSENCE_REPOSITORY === 'true',

  /**
   * Enable Fee Configuration Service repository pattern
   *
   * When enabled: Uses FeeConfigurationRepository instead of in-memory arrays
   * Default: false
   */
  USE_FEE_CONFIGURATION_REPOSITORY: process.env.USE_FEE_CONFIGURATION_REPOSITORY === 'true',

  /**
   * Enable Payment Settings Service repository pattern
   *
   * When enabled: Uses PaymentSettingsRepository instead of in-memory arrays
   * Default: false
   */
  USE_PAYMENT_SETTINGS_REPOSITORY: process.env.USE_PAYMENT_SETTINGS_REPOSITORY === 'true',

  /**
   * Enable System Settings Service repository pattern
   *
   * When enabled: Uses SystemSettingsRepository instead of in-memory arrays
   * Default: false
   */
  USE_SYSTEM_SETTINGS_REPOSITORY: process.env.USE_SYSTEM_SETTINGS_REPOSITORY === 'true',

  /**
   * Enable Trial Training Service repository pattern
   *
   * When enabled: Uses TrialTrainingRepository instead of in-memory arrays
   * Default: false
   */
  USE_TRIAL_TRAINING_REPOSITORY: process.env.USE_TRIAL_TRAINING_REPOSITORY === 'true',

  /**
   * Enable Trainer Profile Service repository pattern
   *
   * When enabled: Uses TrainerProfileRepository instead of in-memory arrays
   * Default: false
   */
  USE_TRAINER_PROFILE_REPOSITORY: process.env.USE_TRAINER_PROFILE_REPOSITORY === 'true',

  /**
   * Enable Hourly Rate Service repository pattern
   *
   * When enabled: Uses HourlyRateRepository instead of in-memory arrays
   * Default: false
   */
  USE_HOURLY_RATE_REPOSITORY: process.env.USE_HOURLY_RATE_REPOSITORY === 'true',

  /**
   * Enable SEPA Mandate Service repository pattern
   *
   * When enabled: Uses SEPAMandateRepository instead of in-memory Map
   * Default: false
   */
  USE_SEPA_MANDATE_REPOSITORY: process.env.USE_SEPA_MANDATE_REPOSITORY === 'true',
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
 * Development helper: Log feature flag status
 */
export function logFeatureFlags(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Feature Flags]', {
      billing: FeatureFlags.USE_BILLING_REPOSITORY ? '✅' : '❌',
      course: FeatureFlags.USE_COURSE_REPOSITORY ? '✅' : '❌',
      attendance: FeatureFlags.USE_ATTENDANCE_REPOSITORY ? '✅' : '❌',
      member: FeatureFlags.USE_MEMBER_REPOSITORY ? '✅' : '❌',
      trainer: FeatureFlags.USE_TRAINER_REPOSITORY ? '✅' : '❌',
      absence: FeatureFlags.USE_ABSENCE_REPOSITORY ? '✅' : '❌',
      feeConfig: FeatureFlags.USE_FEE_CONFIGURATION_REPOSITORY ? '✅' : '❌',
      paymentSettings: FeatureFlags.USE_PAYMENT_SETTINGS_REPOSITORY ? '✅' : '❌',
      systemSettings: FeatureFlags.USE_SYSTEM_SETTINGS_REPOSITORY ? '✅' : '❌',
      trialTraining: FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY ? '✅' : '❌',
      trainerProfile: FeatureFlags.USE_TRAINER_PROFILE_REPOSITORY ? '✅' : '❌',
      hourlyRate: FeatureFlags.USE_HOURLY_RATE_REPOSITORY ? '✅' : '❌',
      sepaMandate: FeatureFlags.USE_SEPA_MANDATE_REPOSITORY ? '✅' : '❌',
    });
  }
}
