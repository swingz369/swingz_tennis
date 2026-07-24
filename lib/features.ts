/**
 * Central feature registry for SwingZ club modules.
 *
 * Defines all available features per club. Core features are always enabled
 * and cannot be disabled. Optional features can be toggled in the onboarding
 * wizard and later in Settings → Module.
 *
 * Each feature maps to a sidebar section / app area. When a feature is
 * disabled, its sidebar section, dashboard widgets and routes are hidden.
 */

export type FeatureCategory = 'core' | 'optional';

export interface ClubFeature {
  /** Stable feature key, used in DB and URL queries. Never rename without a migration. */
  key: string;
  /** Human-readable German label. */
  label: string;
  /** Short German description shown in wizard + settings toggle. */
  description: string;
  /** Lucide icon name (resolved at render time). */
  icon: string;
  /** Whether the feature is always-on. Core features cannot be disabled. */
  category: FeatureCategory;
  /** Sidebar section key — when a section's primary feature is disabled, the section hides. */
  sidebarSection?: string;
  /** Optional dependency on another feature. The dependent feature is only available if the dependency is enabled. */
  dependsOn?: string;
  /** Display order in wizard and settings (asc). */
  order: number;
}

/**
 * Master feature list. The order here defines the order in the wizard/settings UI.
 * Add new optional features here — no other code changes required.
 */
export const CLUB_FEATURES: readonly ClubFeature[] = [
  // ── Core (always on) ────────────────────────────────────────────────────
  {
    key: 'members',
    label: 'Mitgliederverwaltung',
    description: 'Verwalte Mitglieder, Einladungen, Genehmigungen und Stammdaten.',
    icon: 'Users',
    category: 'core',
    sidebarSection: 'members',
    order: 1,
  },
  {
    key: 'trainers',
    label: 'Trainer',
    description: 'Trainerprofile, Verfügbarkeiten und Stundenerfassung.',
    icon: 'GraduationCap',
    category: 'core',
    sidebarSection: 'trainers',
    order: 2,
  },
  {
    key: 'seasons',
    label: 'Saisonplanung',
    description: 'Saisonen, automatisches Clustering und Stundenpläne für Trainingsgruppen.',
    icon: 'CalendarDays',
    category: 'core',
    sidebarSection: 'seasons',
    order: 3,
  },
  {
    key: 'finance',
    label: 'Finanzen',
    description: 'Abrechnung, Beitragskategorien, Rechnungen und Mahnwesen.',
    icon: 'DollarSign',
    category: 'core',
    sidebarSection: 'finance',
    order: 4,
  },

  // ── Optional (toggleable) ───────────────────────────────────────────────
  {
    key: 'shop',
    label: 'Shop',
    description: 'Verkauf von Vereinsartikeln, Bällen und Zubehör direkt an Mitglieder.',
    icon: 'ShoppingBag',
    category: 'optional',
    sidebarSection: 'shop',
    order: 5,
  },
  {
    key: 'tournaments',
    label: 'Turniere',
    description: 'Organisation von Vereinsturnieren, Anmeldungen und Spielplänen.',
    icon: 'Trophy',
    category: 'optional',
    sidebarSection: 'tournaments',
    order: 6,
  },
  {
    key: 'trial_training',
    label: 'Probetrainings',
    description: 'Online-Anmeldeformular und Verwaltung von Schnupperstunden.',
    icon: 'FlaskConical',
    category: 'optional',
    sidebarSection: 'trial_training',
    order: 7,
  },
  {
    key: 'ai_matchmaking',
    label: 'KI-Matchmaking',
    description: 'Spielpartner-Matching auf Basis von Niveau und Verfügbarkeit.',
    icon: 'Sparkles',
    category: 'optional',
    sidebarSection: 'ai_matchmaking',
    order: 8,
  },
  {
    key: 'weather_integration',
    label: 'Wetter-Integration',
    description: 'Automatische Platzsperren bei Regen und Schlechtwetter.',
    icon: 'CloudRain',
    category: 'optional',
    sidebarSection: 'weather_integration',
    order: 9,
  },
  {
    key: 'league_lineup',
    label: 'Liga & Mannschaft',
    description: 'Mannschaftsaufstellung, Liga-Verwaltung und Spieltag-Planung.',
    icon: 'Flag',
    category: 'optional',
    sidebarSection: 'league_lineup',
    order: 10,
  },
  {
    key: 'work_duty',
    label: 'Arbeitsdienst',
    description: 'Gemeinschaftsdienst-Verwaltung mit Zuweisung und Nachverfolgung.',
    icon: 'HardHat',
    category: 'optional',
    sidebarSection: 'work_duty',
    order: 11,
  },
  // ponytail: add-on priced separately (€79/Monat) — gates hardware vendor access from 3.1.x
  {
    key: 'smart_court',
    label: 'Smart Court',
    description:
      'Automatische Platzkontrolle via Hardware-Integration (Nuki, Shelly, Loxone). Add-On € 79/Monat.',
    icon: 'Wifi',
    category: 'optional',
    sidebarSection: 'smart_court',
    order: 12,
  },
  {
    key: 'dynamic_pricing',
    label: 'Dynamische Preisgestaltung',
    description:
      'Zeitbasierte Preise für Plätze: Peak/Off-Peak, Tagespreise und Saison-Aufschläge.',
    icon: 'TrendingUp',
    category: 'optional',
    sidebarSection: 'pricing',
    order: 13,
  },
  // Tier-4 (Audit): KI-Analyse als eigenes Modul. Server-seitiges Gate in
  // api/seasons/planning/ai-analysis/route.ts checkt `clubs.features.ai_analysis`
  // via requireFeature. Default OFF — Clubs können das Modul im Onboarding-
  // Wizard oder in Settings → Module aktivieren.
  {
    key: 'ai_analysis',
    label: 'KI-Analyse (Saisonplanung)',
    description:
      'KI-gestützte Plausibilitäts- und Konflikt-Analyse des generierten Saisonplans (Google Gemini Flash).',
    icon: 'Brain',
    category: 'optional',
    sidebarSection: 'ai_analysis',
    order: 14,
  },
] as const;

export type FeatureKey = (typeof CLUB_FEATURES)[number]['key'];

/** Core feature keys — always enabled. */
export const CORE_FEATURE_KEYS: readonly FeatureKey[] = CLUB_FEATURES.filter(
  (f) => f.category === 'core'
).map((f) => f.key);

/** Optional feature keys — toggleable. */
export const OPTIONAL_FEATURE_KEYS: readonly FeatureKey[] = CLUB_FEATURES.filter(
  (f) => f.category === 'optional'
).map((f) => f.key);

/** All keys as a tuple, useful for zod / runtime validation. */
export const ALL_FEATURE_KEYS: readonly FeatureKey[] = CLUB_FEATURES.map((f) => f.key);

/** Default enabled map — core on, optional off. */
export function getDefaultFeatures(): Record<string, boolean> {
  return Object.fromEntries(CLUB_FEATURES.map((f) => [f.key, f.category === 'core']));
}

/**
 * Validate a feature-flag map from the DB. Ensures only known keys are
 * present and at least all core features are enabled.
 */
export function sanitizeFeatureFlags(
  raw: Record<string, unknown> | null | undefined
): Record<string, boolean> {
  const defaults = getDefaultFeatures();
  if (!raw || typeof raw !== 'object') return defaults;
  for (const [key, value] of Object.entries(raw)) {
    if (ALL_FEATURE_KEYS.includes(key as FeatureKey) && typeof value === 'boolean') {
      defaults[key] = value;
    }
  }
  // Core features are immutable: always force-enable them.
  for (const key of CORE_FEATURE_KEYS) {
    defaults[key] = true;
  }
  // Enforce dependencies: if a feature requires another, the required one must be enabled.
  for (const feature of CLUB_FEATURES) {
    if (feature.dependsOn && defaults[feature.key] && !defaults[feature.dependsOn]) {
      defaults[feature.key] = false;
    }
  }
  return defaults;
}

/** Lookup helper. */
export function getFeature(key: string): ClubFeature | undefined {
  return CLUB_FEATURES.find((f) => f.key === key);
}

/**
 * Returns the subset of sidebar sections that should be hidden for a given
 * feature-flag map. A section is hidden if its `sidebarSection` matches the
 * key of a disabled feature.
 */
export function getHiddenSidebarSections(features: Record<string, boolean>): Set<string> {
  const hidden = new Set<string>();
  for (const feature of CLUB_FEATURES) {
    if (feature.sidebarSection && !features[feature.key]) {
      hidden.add(feature.sidebarSection);
    }
  }
  return hidden;
}
