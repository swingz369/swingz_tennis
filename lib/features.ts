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

/**
 * Admin-Sidebar-Sektionen. Feste Reihenfolge im Vereins-Workflow
 * (wer ist drin → wer unterrichtet → was läuft → wer zahlt → Verein).
 * Die Sektionen selbst (Label, Icon, Pflicht-Links) stehen in
 * lib/navigation.ts; hierher gehört nur, in welche Sektion ein optionales
 * Modul seinen Link einhängt.
 */
export type AdminSectionKey = 'members' | 'trainers' | 'play' | 'finance' | 'club';

/**
 * Wo ein optionales Modul in der Admin-Sidebar erscheint.
 *
 * `nav: null` heisst bewusst: dieses Modul hat KEINEN eigenen Admin-Link —
 * entweder ist es ein Widget auf einer bestehenden Seite (Wetter) oder eine
 * reine Mitglieder-Funktion (Board-Beschlüsse, Wallet, Gamification). Ein
 * explizites `null` statt des blossen Weglassens verhindert, dass ein Modul
 * „still" nirgends auftaucht und der nächste Agent den Link doppelt erfindet.
 */
export interface AdminNavPlacement {
  section: AdminSectionKey;
  /** Link-Beschriftung in der Sidebar — deckungsgleich mit dem Seiteninhalt. */
  label: string;
  href: string;
}

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
  /**
   * Admin-Navigation des Moduls. Nur optionale Module setzen das:
   * `{ section, label, href }` = Sidebar-Link, `null` = bewusst kein
   * Admin-Link. Core-Module lassen es weg — ihre Links sind die festen
   * Sektionen in lib/navigation.ts.
   */
  nav?: AdminNavPlacement | null;
  /** Optional dependency on another feature. The dependent feature is only available if the dependency is enabled. */
  dependsOn?: string;
  /**
   * Optionales Modul, das für neue Vereine standardmäßig aktiv ist (weiterhin
   * abschaltbar). Probetraining ist z. B. der primäre Mitglieder-Zulauf eines
   * Tennisvereins — es soll niemand erst einschalten müssen.
   */
  defaultEnabled?: boolean;
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
    order: 1,
  },
  {
    key: 'trainers',
    label: 'Trainer',
    description: 'Trainerprofile, Verfügbarkeiten und Stundenerfassung.',
    icon: 'GraduationCap',
    category: 'core',
    order: 2,
  },
  {
    key: 'seasons',
    label: 'Saisonplanung',
    description: 'Saisonen, automatisches Clustering und Stundenpläne für Trainingsgruppen.',
    icon: 'CalendarDays',
    category: 'core',
    order: 3,
  },
  {
    key: 'finance',
    label: 'Finanzen',
    description: 'Abrechnung, Beitragskategorien, Rechnungen und Mahnwesen.',
    icon: 'DollarSign',
    category: 'core',
    order: 4,
  },

  // ── Optional ───────────────────────────────────────────────────────────
  // Reihenfolge = Nutzen für den Verein, nicht Einbaudatum: was Mitglieder und damit
  // Beiträge bringt zuerst (Probetraining, Familienkonten), dann der reguläre
  // Vereinsbetrieb (Arbeitsdienst, Liga, Turniere), zuletzt Beiwerk. Gerendert wird
  // diese Array-Reihenfolge — das `order`-Feld sortiert nirgends etwas.
  {
    key: 'trial_training',
    label: 'Probetrainings',
    description: 'Online-Anmeldeformular und Verwaltung von Schnupperstunden.',
    icon: 'FlaskConical',
    category: 'optional',
    nav: { section: 'members', label: 'Probetrainings', href: '/admin/trial-training' },
    // Standard aktiv: Probetraining ist der primäre Neukunden-Zulauf — ein
    // Verein soll es nicht erst entdecken und einschalten müssen.
    defaultEnabled: true,
    order: 5,
  },
  {
    key: 'family_accounts',
    label: 'Familienkonten',
    description: 'Eltern verwalten mehrere Kinderkonten unter einem Login.',
    icon: 'Users',
    category: 'optional',
    nav: { section: 'members', label: 'Familienkonten', href: '/admin/members/family' },
    order: 6,
  },
  {
    key: 'work_duty',
    label: 'Arbeitsdienst',
    description: 'Gemeinschaftsdienst-Verwaltung mit Zuweisung und Nachverfolgung.',
    icon: 'HardHat',
    category: 'optional',
    // Ein Link statt zwei („Arbeitsdienste" + „Zuweisungen"): Dienste und
    // Zuweisungen sind zwei Sichten derselben Daten und liegen jetzt als
    // Tabs auf /admin/work-duties.
    nav: { section: 'members', label: 'Arbeitsdienste', href: '/admin/work-duties' },
    order: 7,
  },
  {
    key: 'league_lineup',
    label: 'Liga & Mannschaft',
    description: 'Mannschaftsaufstellung, Liga-Verwaltung und Spieltag-Planung.',
    icon: 'Flag',
    category: 'optional',
    nav: { section: 'play', label: 'Ligen & Mannschaften', href: '/admin/leagues' },
    order: 8,
  },
  {
    key: 'tournaments',
    label: 'Turniere',
    description: 'Organisation von Vereinsturnieren, Anmeldungen und Spielplänen.',
    icon: 'Trophy',
    category: 'optional',
    // Kein eigener Admin-Link mehr: „Turniere" ist ein Tab im immer sichtbaren
    // Veranstaltungen-Hub (/admin/events). Dieses Flag schaltet nur den Tab
    // und die Mitglieder-Sicht (/member/tournaments).
    nav: null,
    order: 9,
  },
  {
    key: 'weather_integration',
    label: 'Wetter am Vereinsort',
    // Hieß „Automatische Platzsperren bei Regen und Schlechtwetter" — gesperrt wird
    // aber nichts automatisch, und das war auch nie implementiert.
    description:
      'Zeigt die aktuelle Wetterlage neben den Platzsperren, damit die Entscheidung zum Sperren auf einer Zahl statt auf dem Blick aus dem Fenster beruht.',
    icon: 'CloudRain',
    category: 'optional',
    // Kein eigener Link: ein Widget innerhalb des Plätze-Hubs
    // (/admin/courts?view=manage&tab=closures).
    nav: null,
    order: 10,
  },
  {
    key: 'partner_finder',
    label: 'Spielpartner-Suche',
    description: 'Spielpartner-Matching auf Basis von Niveau und Verfügbarkeit.',
    icon: 'Shuffle',
    category: 'optional',
    // Admin-Link heisst bewusst „Übersicht": die Admin-Seite zeigt nur
    // Vereinskennzahlen. Die persönliche Suche gehört zur Mitglieder-Sicht
    // (/partner-finder) — saubere Rollentrennung, keine Vermischung.
    nav: { section: 'play', label: 'Spielpartner-Übersicht', href: '/admin/partner-finder' },
    order: 12,
  },
  // ── Optional (toggleable) ───────────────────────────────────────────────
  {
    key: 'shop',
    label: 'Shop',
    description: 'Verkauf von Vereinsartikeln, Bällen und Zubehör direkt an Mitglieder.',
    icon: 'ShoppingBag',
    category: 'optional',
    nav: { section: 'finance', label: 'Shop', href: '/admin/shop' },
    order: 13,
  },
  {
    key: 'decisions',
    label: 'Board-Beschlüsse',
    description: 'Digitale Beschlussfassung und Abstimmungen für den Vorstand.',
    icon: 'Gavel',
    category: 'optional',
    // Reine Mitglieder-Funktion (/decisions); eine eigene Admin-Seite gibt es
    // aktuell nicht — der Link unter Mitgliedern existiert trotzdem.
    nav: null,
    order: 14,
  },
  // Testbudget, standardmäßig aus. Nicht gelöscht, nur per Flag verborgen.
  {
    key: 'gamification',
    label: 'Gamification',
    description: 'Punkte, Abzeichen und Ranglisten für Mitglieder.',
    icon: 'Trophy',
    category: 'optional',
    // Reine Mitglieder-Funktion (/gamification), standardmäßig aus.
    nav: null,
    order: 15,
  },
  {
    key: 'wallet_passes',
    label: 'Wallet-Pässe',
    description: 'Apple/Google-Wallet-Mitgliedsausweise.',
    icon: 'Wallet',
    category: 'optional',
    // Reine Mitglieder-Funktion (Ausweis auf dem eigenen Gerät), keine
    // Admin-Seite.
    nav: null,
    order: 16,
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

/** Default enabled map — core on, optional off, defaultEnabled-optionale on. */
export function getDefaultFeatures(): Record<string, boolean> {
  return Object.fromEntries(
    CLUB_FEATURES.map((f) => [f.key, f.category === 'core' || f.defaultEnabled === true])
  );
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
