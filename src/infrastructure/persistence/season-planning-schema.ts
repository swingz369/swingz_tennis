import {
  pgTable,
  timestamp,
  boolean,
  jsonb,
  uuid,
  varchar,
  integer,
  numeric,
  index,
  text,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
import { seasons, users, trainers, clubs, groups } from './schema';

// ============================================
// SEASON WAITLISTS
// ============================================

export const seasonWaitlists = pgTable(
  'season_waitlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season_id: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    group_id: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Waitlist position and priority
    position: integer('position').notNull(),
    priority: integer('priority').notNull().default(5), // 1-10, lower = higher priority
    priority_reason: varchar('priority_reason', { length: 50 }).default('registration_time'),

    // Status tracking
    status: varchar('status', { length: 20 }).notNull().default('waiting'), // waiting, notified, accepted, declined, expired
    registered_at: timestamp('registered_at').notNull().defaultNow(),
    notified_at: timestamp('notified_at'),
    accepted_at: timestamp('accepted_at'),

    // Alternative assignment
    alternative_group_id: uuid('alternative_group_id').references(() => groups.id, {
      onDelete: 'set null',
    }),
    alternative_assigned_at: timestamp('alternative_assigned_at'),

    // Notes
    notes: text('notes'),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    season_idx: index('waitlists_season_idx').on(table.season_id),
    club_idx: index('waitlists_club_idx').on(table.club_id),
    group_idx: index('waitlists_group_idx').on(table.group_id),
    member_idx: index('waitlists_member_idx').on(table.member_id),
    status_idx: index('waitlists_status_idx').on(table.status),
    group_position_idx: index('waitlists_group_position_idx').on(table.group_id, table.position),
  })
);

// ============================================
// TRAINER FEEDBACK (End-of-Season)
// ============================================

export const trainerFeedback = pgTable(
  'trainer_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season_id: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    group_id: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),

    // Attendance (auto-captured but trainer can override)
    attendance_quote: numeric('attendance_quote', { precision: 5, scale: 2 }), // e.g. 85.50 = 85.5%

    // Ready for next level
    ready_for_next_level: varchar('ready_for_next_level', { length: 20 }).default('undecided'), // yes, no, undecided
    recommended_level: varchar('recommended_level', { length: 20 }),

    // Free-text notes (internal, visible only to admin + KI)
    notes: text('notes'),

    // Performance metrics
    performance_rating: integer('performance_rating'), // 1-10
    strengths: jsonb('strengths').$type<string[]>().default([]),
    areas_for_improvement: jsonb('areas_for_improvement').$type<string[]>().default([]),

    submitted_at: timestamp('submitted_at'),
    is_submitted: boolean('is_submitted').notNull().default(false),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    season_idx: index('feedback_season_idx').on(table.season_id),
    club_idx: index('feedback_club_idx').on(table.club_id),
    trainer_idx: index('feedback_trainer_idx').on(table.trainer_id),
    member_idx: index('feedback_member_idx').on(table.member_id),
    submitted_idx: index('feedback_submitted_idx').on(table.season_id, table.is_submitted),
    ready_idx: index('feedback_ready_idx').on(table.season_id, table.ready_for_next_level),
  })
);

// ============================================
// SEASON STATISTICS (Cross-Season Aggregation)
// ============================================

export const seasonStatistics = pgTable(
  'season_statistics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season_id: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),

    // Group performance
    total_groups: integer('total_groups').notNull().default(0),
    total_members_planned: integer('total_members_planned').notNull().default(0),
    avg_group_size: numeric('avg_group_size', { precision: 5, scale: 2 }).default('0'),
    groups_below_min_size: integer('groups_below_min_size').notNull().default(0),

    // Attendance metrics
    overall_attendance_quote: numeric('overall_attendance_quote', { precision: 5, scale: 2 }),
    attendance_by_group: jsonb('attendance_by_group').$type<Record<string, number>>().default({}),
    attendance_by_trainer: jsonb('attendance_by_trainer')
      .$type<Record<string, number>>()
      .default({}),

    // Slot failure rates
    slot_failure_rates: jsonb('slot_failure_rates')
      .$type<
        Record<
          string,
          {
            dayOfWeek: number;
            startTime: string;
            failureRate: number;
            totalSessions: number;
            cancelledSessions: number;
          }
        >
      >()
      .default({}),

    // Wish partner fulfillment
    wish_partner_requests: integer('wish_partner_requests').notNull().default(0),
    wish_partner_fulfilled: integer('wish_partner_fulfilled').notNull().default(0),
    wish_partner_fulfillment_rate: numeric('wish_partner_fulfillment_rate', {
      precision: 5,
      scale: 2,
    }),

    // Waitlist metrics
    total_waitlist_entries: integer('total_waitlist_entries').notNull().default(0),
    avg_waitlist_duration_days: numeric('avg_waitlist_duration_days', {
      precision: 7,
      scale: 2,
    }),
    waitlist_acceptance_rate: numeric('waitlist_acceptance_rate', { precision: 5, scale: 2 }),

    // Level upgrades from trainer feedback
    level_upgrades_recommended: integer('level_upgrades_recommended').notNull().default(0),
    level_upgrades_applied: integer('level_upgrades_applied').notNull().default(0),

    // Trainer metrics
    trainer_utilization_avg: numeric('trainer_utilization_avg', { precision: 5, scale: 2 }),
    trainer_burnout_warnings: integer('trainer_burnout_warnings').notNull().default(0),

    // Conflict metrics
    total_conflicts_detected: integer('total_conflicts_detected').notNull().default(0),
    critical_conflicts: integer('critical_conflicts').notNull().default(0),
    conflicts_resolved: integer('conflicts_resolved').notNull().default(0),

    // Preference metrics
    preferences_submitted: integer('preferences_submitted').notNull().default(0),
    preferences_total: integer('preferences_total').notNull().default(0),
    preference_satisfaction_score: numeric('preference_satisfaction_score', {
      precision: 5,
      scale: 2,
    }),

    // Niveau span metrics
    niveau_span_violations: integer('niveau_span_violations').notNull().default(0),
    avg_niveau_span_months: numeric('avg_niveau_span_months', { precision: 5, scale: 2 }),

    computed_at: timestamp('computed_at').notNull().defaultNow(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    season_unique: index('stats_season_unique').on(table.season_id),
    club_idx: index('stats_club_idx').on(table.club_id),
  })
);

// ============================================
// SEASON PLANNING CONFIGURATION
// ============================================

export const seasonPlanningConfigs = pgTable(
  'season_planning_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    season_id: uuid('season_id').references(() => seasons.id, { onDelete: 'cascade' }),

    // Niveau span limits
    max_niveau_span_beginner_months: integer('max_niveau_span_beginner_months')
      .notNull()
      .default(4),
    max_niveau_span_advanced_months: integer('max_niveau_span_advanced_months')
      .notNull()
      .default(8),

    // Trainer load
    trainer_utilization_max_pct: integer('trainer_utilization_max_pct').notNull().default(80),

    // Slot risk
    slot_failure_rate_threshold_pct: integer('slot_failure_rate_threshold_pct')
      .notNull()
      .default(30),

    // Waitlist
    waitlist_priority_rule: varchar('waitlist_priority_rule', { length: 30 })
      .notNull()
      .default('registration_time'),

    // Group sizing
    group_min_size: integer('group_min_size').notNull().default(3),
    group_max_size: integer('group_max_size').notNull().default(12),
    kids_group_max_size: integer('kids_group_max_size').notNull().default(6),
    kids_group_min_size: integer('kids_group_min_size').notNull().default(3),

    // Historic group reuse
    proven_group_attendance_threshold_pct: integer('proven_group_attendance_threshold_pct')
      .notNull()
      .default(80),

    // Slot configuration
    slot_duration_minutes: integer('slot_duration_minutes').notNull().default(90),

    // AI/Algorithm
    ai_clustering_enabled: boolean('ai_clustering_enabled').notNull().default(true),
    prefer_historic_groups: boolean('prefer_historic_groups').notNull().default(true),
    avoid_high_failure_slots: boolean('avoid_high_failure_slots').notNull().default(true),

    // Optimization #5: Treat high-failure-rate slots as a hard constraint
    treat_high_failure_as_hard: boolean('treat_high_failure_as_hard').notNull().default(false),

    // Optimization #6: Backtracking depth for unassigned members (0 = disabled, capped at 3 at runtime)
    backtrack_depth: integer('backtrack_depth').notNull().default(0),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('planning_config_club_idx').on(table.club_id),
    season_idx: index('planning_config_season_idx').on(table.season_id),
    club_season_unique: index('planning_config_club_season_unique').on(
      table.club_id,
      table.season_id
    ),
  })
);

// ============================================
// RELATIONS
// ============================================

export const seasonWaitlistsRelations = relations(seasonWaitlists, ({ one }) => ({
  season: one(seasons, {
    fields: [seasonWaitlists.season_id],
    references: [seasons.id],
  }),
  club: one(clubs, {
    fields: [seasonWaitlists.club_id],
    references: [clubs.id],
  }),
  group: one(groups, {
    fields: [seasonWaitlists.group_id],
    references: [groups.id],
  }),
  member: one(users, {
    fields: [seasonWaitlists.member_id],
    references: [users.id],
  }),
  alternativeGroup: one(groups, {
    fields: [seasonWaitlists.alternative_group_id],
    references: [groups.id],
  }),
}));

export const trainerFeedbackRelations = relations(trainerFeedback, ({ one }) => ({
  season: one(seasons, {
    fields: [trainerFeedback.season_id],
    references: [seasons.id],
  }),
  club: one(clubs, {
    fields: [trainerFeedback.club_id],
    references: [clubs.id],
  }),
  trainer: one(trainers, {
    fields: [trainerFeedback.trainer_id],
    references: [trainers.id],
  }),
  member: one(users, {
    fields: [trainerFeedback.member_id],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [trainerFeedback.group_id],
    references: [groups.id],
  }),
}));

export const seasonStatisticsRelations = relations(seasonStatistics, ({ one }) => ({
  season: one(seasons, {
    fields: [seasonStatistics.season_id],
    references: [seasons.id],
  }),
  club: one(clubs, {
    fields: [seasonStatistics.club_id],
    references: [clubs.id],
  }),
}));

export const seasonPlanningConfigsRelations = relations(seasonPlanningConfigs, ({ one }) => ({
  club: one(clubs, {
    fields: [seasonPlanningConfigs.club_id],
    references: [clubs.id],
  }),
  season: one(seasons, {
    fields: [seasonPlanningConfigs.season_id],
    references: [seasons.id],
  }),
}));
