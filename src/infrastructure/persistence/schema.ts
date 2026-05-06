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

export const clubs = pgTable(
  'clubs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    max_members: integer('max_members').notNull().default(500),
    opening_hours: jsonb('opening_hours')
      .$type<{
        monday: { open: string; close: string };
        tuesday: { open: string; close: string };
        wednesday: { open: string; close: string };
        thursday: { open: string; close: string };
        friday: { open: string; close: string };
        saturday: { open: string; close: string };
        sunday: { open: string; close: string };
      }>()
      .notNull(),
    default_hourly_rate: numeric('default_hourly_rate', { precision: 10, scale: 2 })
      .notNull()
      .default('15.00'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    name_idx: index('name_idx').on(table.name),
  })
);

export const clubMemberships = pgTable(
  'club_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull(),
    role: varchar('role', { length: 50 }).notNull().default('member'),
    join_date: timestamp('join_date').notNull().defaultNow(),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    club_user_idx: index('club_members_club_user_idx').on(table.club_id, table.user_id),
    user_idx: index('club_members_user_idx').on(table.user_id),
    role_idx: index('club_members_role_idx').on(table.role),
  })
);

export const trainers = pgTable('trainers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  specialties: jsonb('specialties').$type<string[]>().notNull().default([]),
  max_hours_per_week: integer('max_hours_per_week').notNull().default(30),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const trainerClubs = pgTable(
  'trainer_club',
  {
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: { primaryKey: true, columns: [table.trainer_id, table.club_id] },
    trainer_idx: index('trainer_club_trainer_idx').on(table.trainer_id),
    club_idx: index('trainer_club_club_idx').on(table.club_id),
  })
);

export const courts = pgTable('courts', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  surface: varchar('surface', { length: 20 }).notNull().default('hard'),
  has_indoor: boolean('has_indoor').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  season_type: varchar('season_type', { length: 20 }).notNull(),
  season_year: integer('season_year').notNull(),
  season_start_date: timestamp('season_start_date').notNull(),
  season_end_date: timestamp('season_end_date').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const trainingGroups = pgTable('training_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  schedule_id: uuid('schedule_id')
    .notNull()
    .references(() => schedules.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  level: varchar('level', { length: 20 }).notNull().default('intermediate'),
  age_group: varchar('age_group', { length: 20 }).notNull().default('senior'),
  is_active: boolean('is_active').notNull().default(true),
});

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    level: varchar('level', { length: 20 }).notNull().default('intermediate'),
    age_group: varchar('age_group', { length: 20 }).notNull().default('senior'),
    is_active: boolean('is_active').notNull().default(true),
    member_ids: jsonb('member_ids').$type<string[]>().notNull().default([]),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('groups_club_idx').on(table.club_id),
    club_name_idx: index('groups_club_name_idx').on(table.club_id, table.name),
  })
);

export const pricing_rules = pgTable(
  'pricing_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    court_id: uuid('court_id').references(() => courts.id, { onDelete: 'cascade' }),
    rule_type: varchar('rule_type', { length: 50 }).notNull().default('hourly'), // 'hourly', 'member', 'trial', 'group'
    min_booking_hours: numeric('min_booking_hours', { precision: 5, scale: 2 }).default('1'),
    max_booking_hours: numeric('max_booking_hours', { precision: 5, scale: 2 }).default('4'),
    price_per_hour: numeric('price_per_hour', { precision: 10, scale: 2 }).notNull(),
    advance_booking_days: integer('advance_booking_days').default(7),
    applies_to_member_types: jsonb('applies_to_member_types').$type<string[]>().default([]), // [] = all
    applies_to_groups: jsonb('applies_to_groups').$type<string[]>().default([]), // [] = all
    priority: integer('priority').notNull().default(0), // higher = more specific, wins over lower
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('pricing_rules_club_idx').on(table.club_id),
    court_idx: index('pricing_rules_court_idx').on(table.court_id),
    club_priority_idx: index('pricing_rules_club_priority_idx').on(table.club_id, table.priority),
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schedule_id: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id),
    group_ids: jsonb('group_ids').$type<string[]>().notNull(),
    week_number: integer('week_number').notNull(),
    timeslot_start: timestamp('timeslot_start').notNull(),
    timeslot_end: timestamp('timeslot_end').notNull(),
    court_id: uuid('court_id').references(() => courts.id),
    max_participants: integer('max_participants').notNull().default(10),
    notes: text('notes'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    schedule_idx: index('sessions_schedule_idx').on(table.schedule_id),
    trainer_idx: index('sessions_trainer_idx').on(table.trainer_id),
    court_idx: index('sessions_court_idx').on(table.court_id),
    week_idx: index('sessions_week_idx').on(table.week_number),
  })
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id),
    member_id: uuid('member_id').notNull(),
    schedule_id: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id),
    session_id: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    booked_at: timestamp('booked_at').notNull().defaultNow(),
    session_start_time: timestamp('session_start_time').notNull(), // For cancellation policy calculations
    cancelled_at: timestamp('cancelled_at'),
    cancellation_reason: varchar('cancellation_reason', { length: 50 }),
    cancellation_notes: text('cancellation_notes'),
  },
  (table) => ({
    club_idx: index('bookings_club_idx').on(table.club_id),
    member_idx: index('bookings_member_idx').on(table.member_id),
    session_idx: index('bookings_session_idx').on(table.session_id),
    status_idx: index('bookings_status_idx').on(table.status),
  })
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  full_name: varchar('full_name', { length: 100 }),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const userClubMemberships = pgTable(
  'user_club_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('member'), // 'member' | 'trainer' | 'admin' | 'superadmin'
    joined_at: timestamp('joined_at').notNull().defaultNow(),
    is_active: boolean('is_active').notNull().default(true),
    tenant_id: varchar('tenant_id', { length: 100 }), // Für Multi-Tenant Isolation
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: { primaryKey: true, columns: [table.user_id, table.club_id] },
    user_club_idx: index('user_club_memberships_user_club_idx').on(table.user_id, table.club_id),
    tenant_idx: index('user_club_memberships_tenant_idx').on(table.tenant_id),
  })
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actor_id: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 50 }).notNull(),
    resource_type: varchar('resource_type', { length: 50 }).notNull(),
    resource_id: uuid('resource_id').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().default({}),
    ip_address: varchar('ip_address', { length: 45 }),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    actor_idx: index('audit_logs_actor_idx').on(table.actor_id),
    resource_idx: index('audit_logs_resource_idx').on(table.resource_id, table.resource_type),
    action_idx: index('audit_logs_action_idx').on(table.action),
    created_at_idx: index('audit_logs_created_at_idx').on(table.created_at),
  })
);

export const courtsRelations = relations(courts, ({ one }) => ({
  club: one(clubs, {
    fields: [courts.club_id],
    references: [clubs.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  schedule: one(schedules, {
    fields: [sessions.schedule_id],
    references: [schedules.id],
  }),
  trainer: one(trainers, {
    fields: [sessions.trainer_id],
    references: [trainers.id],
  }),
  court: one(courts, {
    fields: [sessions.court_id],
    references: [courts.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  club: one(clubs, {
    fields: [schedules.club_id],
    references: [clubs.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  club: one(clubs, {
    fields: [bookings.club_id],
    references: [clubs.id],
  }),
  schedule: one(schedules, {
    fields: [bookings.schedule_id],
    references: [schedules.id],
  }),
  session: one(sessions, {
    fields: [bookings.session_id],
    references: [sessions.id],
  }),
}));

export const clubMembershipsRelations = relations(clubMemberships, ({ one }) => ({
  club: one(clubs, {
    fields: [clubMemberships.club_id],
    references: [clubs.id],
  }),
}));

export const trainerClubsRelations = relations(trainerClubs, ({ one }) => ({
  trainer: one(trainers, {
    fields: [trainerClubs.trainer_id],
    references: [trainers.id],
  }),
  club: one(clubs, {
    fields: [trainerClubs.club_id],
    references: [clubs.id],
  }),
}));

// ============================================
// SEASON PLANNING SYSTEM TABLES
// ============================================

export const seasons = pgTable(
  'seasons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),

    // Season identification
    name: varchar('name', { length: 100 }).notNull(),
    season_type: varchar('season_type', { length: 20 }).notNull(),
    year: integer('year').notNull(),

    // Date ranges
    start_date: timestamp('start_date', { mode: 'date' }).notNull(),
    end_date: timestamp('end_date', { mode: 'date' }).notNull(),

    // Planning status
    planning_status: varchar('planning_status', { length: 20 }).notNull().default('draft'),

    // Preferences collection
    preferences_deadline: timestamp('preferences_deadline', { mode: 'date' }),
    preferences_open: boolean('preferences_open').notNull().default(false),

    // Auto-planning configuration
    auto_plan_enabled: boolean('auto_plan_enabled').notNull().default(true),
    auto_plan_config: jsonb('auto_plan_config')
      .$type<{
        max_iterations: number;
        optimization_goals: string[];
        allow_overbooking: boolean;
        prefer_consistent_timeslots: boolean;
      }>()
      .default({
        max_iterations: 1000,
        optimization_goals: ['minimize_conflicts', 'balance_trainer_load', 'maximize_preferences'],
        allow_overbooking: false,
        prefer_consistent_timeslots: true,
      }),

    // Metadata
    description: text('description'),
    notes: text('notes'),
    created_by: uuid('created_by').references(() => users.id),
    last_planned_at: timestamp('last_planned_at'),
    published_at: timestamp('published_at'),
    is_active: boolean('is_active').notNull().default(false),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    club_active_idx: index('seasons_club_active_idx').on(table.club_id, table.is_active),
    club_dates_idx: index('seasons_club_dates_idx').on(
      table.club_id,
      table.start_date,
      table.end_date
    ),
    planning_status_idx: index('seasons_planning_status_idx').on(table.planning_status),
  })
);

export const userTrainingPreferences = pgTable(
  'user_training_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season_id: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),

    // User role context
    user_role: varchar('user_role', { length: 20 }).notNull(),

    // Training preferences
    preferred_level: varchar('preferred_level', { length: 20 }),
    preferred_age_group: varchar('preferred_age_group', { length: 20 }),
    preferred_group_ids: jsonb('preferred_group_ids').$type<string[]>().default([]),

    // Availability preferences (weekly recurring)
    weekly_availability: jsonb('weekly_availability')
      .$type<{
        monday: Array<{ start: string; end: string }>;
        tuesday: Array<{ start: string; end: string }>;
        wednesday: Array<{ start: string; end: string }>;
        thursday: Array<{ start: string; end: string }>;
        friday: Array<{ start: string; end: string }>;
        saturday: Array<{ start: string; end: string }>;
        sunday: Array<{ start: string; end: string }>;
      }>()
      .notNull()
      .default({
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      }),

    // Specific unavailable dates
    unavailable_dates: jsonb('unavailable_dates').$type<string[]>().default([]),

    // Trainer-specific fields
    max_sessions_per_week: integer('max_sessions_per_week'),
    preferred_court_ids: jsonb('preferred_court_ids').$type<string[]>().default([]),
    can_teach_groups: jsonb('can_teach_groups').$type<string[]>().default([]),

    // Priority and notes
    priority: integer('priority').notNull().default(5),
    special_requests: text('special_requests'),
    notes: text('notes'),

    // Submission tracking
    submitted_at: timestamp('submitted_at'),
    is_submitted: boolean('is_submitted').notNull().default(false),
    last_modified_at: timestamp('last_modified_at').defaultNow(),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    season_idx: index('user_prefs_season_idx').on(table.season_id),
    user_idx: index('user_prefs_user_idx').on(table.user_id),
    club_idx: index('user_prefs_club_idx').on(table.club_id),
    submitted_idx: index('user_prefs_submitted_idx').on(table.season_id, table.is_submitted),
  })
);

export const seasonPlanEntries = pgTable(
  'season_plan_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season_id: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),

    // Session details
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'restrict' }),
    court_id: uuid('court_id').references(() => courts.id, { onDelete: 'set null' }),
    group_id: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),

    // Timing (recurring weekly pattern)
    day_of_week: integer('day_of_week').notNull(),
    start_time: varchar('start_time', { length: 8 }).notNull(), // "HH:MM:SS"
    end_time: varchar('end_time', { length: 8 }).notNull(),
    duration_minutes: integer('duration_minutes').notNull(),

    // Recurrence within season
    starts_from_week: integer('starts_from_week').notNull().default(1),
    ends_at_week: integer('ends_at_week'),

    // Planning metadata
    entry_type: varchar('entry_type', { length: 20 }).notNull().default('training'),
    planning_source: varchar('planning_source', { length: 20 }).notNull().default('auto'),

    // Quality scores
    preference_match_score: numeric('preference_match_score', { precision: 5, scale: 2 }).default(
      '0'
    ),
    conflict_score: numeric('conflict_score', { precision: 5, scale: 2 }).default('0'),
    optimization_score: numeric('optimization_score', { precision: 5, scale: 2 }).default('0'),

    // Participants
    max_participants: integer('max_participants').notNull().default(10),
    expected_participants: jsonb('expected_participants').$type<string[]>().default([]),

    // Status
    status: varchar('status', { length: 20 }).notNull().default('planned'),

    // Link to actual session (after publishing)
    published_session_id: uuid('published_session_id').references(() => sessions.id, {
      onDelete: 'set null',
    }),
    published_at: timestamp('published_at'),

    // Notes
    notes: text('notes'),
    admin_notes: text('admin_notes'),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    season_idx: index('plan_entries_season_idx').on(table.season_id),
    club_idx: index('plan_entries_club_idx').on(table.club_id),
    trainer_idx: index('plan_entries_trainer_idx').on(table.trainer_id),
    court_idx: index('plan_entries_court_idx').on(table.court_id),
    group_idx: index('plan_entries_group_idx').on(table.group_id),
    day_time_idx: index('plan_entries_day_time_idx').on(table.day_of_week, table.start_time),
    status_idx: index('plan_entries_status_idx').on(table.status),
  })
);

export const planningConflicts = pgTable(
  'planning_conflicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season_id: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),

    // Conflict identification
    conflict_type: varchar('conflict_type', { length: 50 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull().default('medium'),

    // Affected entities
    affected_plan_entry_ids: jsonb('affected_plan_entry_ids')
      .$type<string[]>()
      .notNull()
      .default([]),
    affected_trainer_id: uuid('affected_trainer_id').references(() => trainers.id, {
      onDelete: 'cascade',
    }),
    affected_court_id: uuid('affected_court_id').references(() => courts.id, {
      onDelete: 'set null',
    }),
    affected_user_ids: jsonb('affected_user_ids').$type<string[]>().default([]),
    affected_group_ids: jsonb('affected_group_ids').$type<string[]>().default([]),

    // Conflict details
    conflict_time_slot: jsonb('conflict_time_slot').$type<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>(),
    description: text('description').notNull(),
    suggested_resolution: text('suggested_resolution'),

    // Resolution tracking
    status: varchar('status', { length: 20 }).notNull().default('open'),
    resolved_at: timestamp('resolved_at'),
    resolved_by: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolution_notes: text('resolution_notes'),
    resolution_action: varchar('resolution_action', { length: 50 }),

    // Metadata
    detected_at: timestamp('detected_at').notNull().defaultNow(),
    detection_source: varchar('detection_source', { length: 20 }).default('auto_planner'),

    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    season_idx: index('conflicts_season_idx').on(table.season_id),
    club_idx: index('conflicts_club_idx').on(table.club_id),
    status_idx: index('conflicts_status_idx').on(table.status),
    severity_idx: index('conflicts_severity_idx').on(table.severity),
    trainer_idx: index('conflicts_trainer_idx').on(table.affected_trainer_id),
    court_idx: index('conflicts_court_idx').on(table.affected_court_id),
  })
);

export const seasonPlanningHistory = pgTable(
  'season_planning_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    season_id: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),

    action_type: varchar('action_type', { length: 50 }).notNull(),
    actor_id: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actor_role: varchar('actor_role', { length: 20 }),

    // Action details
    details: jsonb('details').$type<Record<string, unknown>>().default({}),
    entries_affected: integer('entries_affected').default(0),
    conflicts_created: integer('conflicts_created').default(0),
    conflicts_resolved: integer('conflicts_resolved').default(0),

    // Algorithm-specific metrics
    algorithm_metrics: jsonb('algorithm_metrics').$type<Record<string, unknown>>(),

    notes: text('notes'),

    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    season_idx: index('planning_history_season_idx').on(table.season_id),
    club_idx: index('planning_history_club_idx').on(table.club_id),
    action_idx: index('planning_history_action_idx').on(table.action_type),
    actor_idx: index('planning_history_actor_idx').on(table.actor_id),
    created_idx: index('planning_history_created_idx').on(table.created_at),
  })
);

// ============================================
// SEASON PLANNING RELATIONS
// ============================================

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  club: one(clubs, {
    fields: [seasons.club_id],
    references: [clubs.id],
  }),
  creator: one(users, {
    fields: [seasons.created_by],
    references: [users.id],
  }),
  preferences: many(userTrainingPreferences),
  planEntries: many(seasonPlanEntries),
  conflicts: many(planningConflicts),
  history: many(seasonPlanningHistory),
}));

export const userTrainingPreferencesRelations = relations(userTrainingPreferences, ({ one }) => ({
  season: one(seasons, {
    fields: [userTrainingPreferences.season_id],
    references: [seasons.id],
  }),
  user: one(users, {
    fields: [userTrainingPreferences.user_id],
    references: [users.id],
  }),
  club: one(clubs, {
    fields: [userTrainingPreferences.club_id],
    references: [clubs.id],
  }),
}));

export const seasonPlanEntriesRelations = relations(seasonPlanEntries, ({ one }) => ({
  season: one(seasons, {
    fields: [seasonPlanEntries.season_id],
    references: [seasons.id],
  }),
  club: one(clubs, {
    fields: [seasonPlanEntries.club_id],
    references: [clubs.id],
  }),
  trainer: one(trainers, {
    fields: [seasonPlanEntries.trainer_id],
    references: [trainers.id],
  }),
  court: one(courts, {
    fields: [seasonPlanEntries.court_id],
    references: [courts.id],
  }),
  group: one(groups, {
    fields: [seasonPlanEntries.group_id],
    references: [groups.id],
  }),
  publishedSession: one(sessions, {
    fields: [seasonPlanEntries.published_session_id],
    references: [sessions.id],
  }),
}));

export const planningConflictsRelations = relations(planningConflicts, ({ one }) => ({
  season: one(seasons, {
    fields: [planningConflicts.season_id],
    references: [seasons.id],
  }),
  club: one(clubs, {
    fields: [planningConflicts.club_id],
    references: [clubs.id],
  }),
  trainer: one(trainers, {
    fields: [planningConflicts.affected_trainer_id],
    references: [trainers.id],
  }),
  court: one(courts, {
    fields: [planningConflicts.affected_court_id],
    references: [courts.id],
  }),
  resolver: one(users, {
    fields: [planningConflicts.resolved_by],
    references: [users.id],
  }),
}));

export const seasonPlanningHistoryRelations = relations(seasonPlanningHistory, ({ one }) => ({
  season: one(seasons, {
    fields: [seasonPlanningHistory.season_id],
    references: [seasons.id],
  }),
  club: one(clubs, {
    fields: [seasonPlanningHistory.club_id],
    references: [clubs.id],
  }),
  actor: one(users, {
    fields: [seasonPlanningHistory.actor_id],
    references: [users.id],
  }),
}));
