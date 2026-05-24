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
    slug: varchar('slug', { length: 200 }),
    timezone: varchar('timezone', { length: 50 }).default('Europe/Berlin'),
    default_session_duration_minutes: integer('default_session_duration_minutes').default(60),
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
    logo_url: text('logo_url'),
    description: text('description'),
    founding_date: timestamp('founding_date', { mode: 'date' }),
    bundesland: varchar('bundesland', { length: 50 }),
    billing_unit_minutes: integer('billing_unit_minutes').default(60),
    tax_rate: integer('tax_rate').default(0),
    default_payment_method: varchar('default_payment_method', { length: 20 }).default('transfer'),
    invoice_number_prefix: varchar('invoice_number_prefix', { length: 10 }),
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

export const trainers = pgTable(
  'trainers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    specialties: jsonb('specialties').$type<string[]>().notNull().default([]),
    max_hours_per_week: integer('max_hours_per_week').notNull().default(30),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    is_active_idx: index('trainers_is_active_idx').on(table.is_active),
    created_at_idx: index('trainers_created_at_idx').on(table.created_at),
  })
);

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

export const courts = pgTable(
  'courts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    surface: varchar('surface', { length: 20 }).notNull().default('hard'),
    has_indoor: boolean('has_indoor').notNull().default(false),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('courts_club_idx').on(table.club_id),
    is_active_idx: index('courts_is_active_idx').on(table.is_active),
    created_at_idx: index('courts_created_at_idx').on(table.created_at),
  })
);

export const schedules = pgTable(
  'schedules',
  {
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
  },
  (table) => ({
    club_idx: index('schedules_club_idx').on(table.club_id),
    season_type_idx: index('schedules_season_type_idx').on(table.season_type),
    season_year_idx: index('schedules_season_year_idx').on(table.season_year),
    is_active_idx: index('schedules_is_active_idx').on(table.is_active),
    created_at_idx: index('schedules_created_at_idx').on(table.created_at),
  })
);

export const trainingGroups = pgTable(
  'training_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    schedule_id: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    level: varchar('level', { length: 20 }).notNull().default('intermediate'),
    age_group: varchar('age_group', { length: 20 }).notNull().default('senior'),
    is_active: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    club_idx: index('training_groups_club_idx').on(table.club_id),
    schedule_idx: index('training_groups_schedule_idx').on(table.schedule_id),
    club_active_idx: index('training_groups_club_active_idx').on(table.club_id, table.is_active),
  })
);

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

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    full_name: varchar('full_name', { length: 100 }),
    phone: varchar('phone', { length: 20 }),
    avatar_url: text('avatar_url'),
    subscription_tier: varchar('subscription_tier', { length: 50 }).default('free'),
    subscription_status: varchar('subscription_status', { length: 20 }).default('active'),
    stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
    stripe_subscription_id: varchar('stripe_subscription_id', { length: 255 }),
    current_period_end: timestamp('current_period_end'),
    // Season planning fields
    experience_months: integer('experience_months').default(0),
    skill_level: varchar('skill_level', { length: 20 }).default('beginner'),
    // Superadmin onboarding completion flag (person-bound, not club-bound)
    superadmin_setup_completed_at: timestamp('superadmin_setup_completed_at'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    created_at_idx: index('users_created_at_idx').on(table.created_at),
    subscription_status_idx: index('users_subscription_status_idx').on(table.subscription_status),
  })
);

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
    include_in_planning: boolean('include_in_planning').notNull().default(true),
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

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id').notNull(),
    invoice_number: varchar('invoice_number', { length: 50 }).notNull().unique(),
    invoice_date: timestamp('invoice_date').notNull().defaultNow(),
    due_date: timestamp('due_date').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
    tax_amount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    paid_amount: numeric('paid_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    notes: text('notes'),
    sent_at: timestamp('sent_at'),
    paid_at: timestamp('paid_at'),
    cancelled_at: timestamp('cancelled_at'),
    cancellation_reason: varchar('cancellation_reason', { length: 50 }),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('invoices_club_idx').on(table.club_id),
    member_idx: index('invoices_member_idx').on(table.member_id),
    invoice_number_unique: index('invoices_invoice_number_unique').on(table.invoice_number),
    status_idx: index('invoices_status_idx').on(table.status),
    due_date_idx: index('invoices_due_date_idx').on(table.due_date),
  })
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoice_id: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    tax_rate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('19'),
    total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
    item_type: varchar('item_type', { length: 20 }).notNull(),
    reference_id: uuid('reference_id'),
    reference_type: varchar('reference_type', { length: 50 }),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    invoice_idx: index('invoice_items_invoice_idx').on(table.invoice_id),
    reference_idx: index('invoice_items_reference_idx').on(table.reference_id),
    item_type_idx: index('invoice_items_item_type_idx').on(table.item_type),
  })
);

export const trainingGroupsRelations = relations(trainingGroups, ({ one }) => ({
  club: one(clubs, {
    fields: [trainingGroups.club_id],
    references: [clubs.id],
  }),
  schedule: one(schedules, {
    fields: [trainingGroups.schedule_id],
    references: [schedules.id],
  }),
}));

export const courtsRelations = relations(courts, ({ one }) => ({
  club: one(clubs, {
    fields: [courts.club_id],
    references: [clubs.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  club: one(clubs, {
    fields: [invoices.club_id],
    references: [clubs.id],
  }),
  member: one(users, {
    fields: [invoices.member_id],
    references: [users.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoice_id],
    references: [invoices.id],
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

    // Wish partners (member IDs they'd like to be grouped with)
    wish_partner_ids: jsonb('wish_partner_ids').$type<string[]>().default([]),
    // Member's self-assessed level (compared with trainer assessment)
    self_assessed_level: varchar('self_assessed_level', { length: 20 }),

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

// ==============================================================================
// Trainer Billing Tables
// ==============================================================================

/**
 * Billing periods for trainer compensation
 */
export const billingPeriods = pgTable(
  'billing_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    start_date: timestamp('start_date', { withTimezone: true }).notNull(),
    end_date: timestamp('end_date', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    date_idx: index('billing_periods_date_idx').on(table.start_date, table.end_date),
    status_idx: index('billing_periods_status_idx').on(table.status),
  })
);

/**
 * Trainer billing records (trainer compensation per period)
 */
export const trainerBillings = pgTable(
  'trainer_billings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    billing_period_id: uuid('billing_period_id')
      .notNull()
      .references(() => billingPeriods.id, { onDelete: 'cascade' }),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'restrict' }),
    trainer_name: varchar('trainer_name', { length: 255 }).notNull(),
    total_hours: numeric('total_hours', { precision: 10, scale: 2 }).notNull(),
    hourly_rate: numeric('hourly_rate', { precision: 10, scale: 2 }).notNull(),
    total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    invoice_id: uuid('invoice_id'),
    invoice_number: varchar('invoice_number', { length: 50 }),
    due_date: timestamp('due_date', { withTimezone: true }),
    paid_at: timestamp('paid_at', { withTimezone: true }),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    period_idx: index('trainer_billings_period_idx').on(table.billing_period_id),
    trainer_idx: index('trainer_billings_trainer_idx').on(table.trainer_id),
    status_idx: index('trainer_billings_status_idx').on(table.status),
    invoice_number_unique: index('trainer_billings_invoice_number_unique').on(table.invoice_number),
  })
);

/**
 * Billing line items (detailed breakdown of trainer hours)
 */
export const billingLineItems = pgTable(
  'billing_line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainer_billing_id: uuid('trainer_billing_id')
      .notNull()
      .references(() => trainerBillings.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    hours: numeric('hours', { precision: 10, scale: 2 }).notNull(),
    rate: numeric('rate', { precision: 10, scale: 2 }).notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    session_id: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    billing_idx: index('billing_line_items_billing_idx').on(table.trainer_billing_id),
    session_idx: index('billing_line_items_session_idx').on(table.session_id),
    date_idx: index('billing_line_items_date_idx').on(table.date),
  })
);

// Relations
export const billingPeriodsRelations = relations(billingPeriods, ({ many }) => ({
  trainerBillings: many(trainerBillings),
}));

export const trainerBillingsRelations = relations(trainerBillings, ({ one, many }) => ({
  billingPeriod: one(billingPeriods, {
    fields: [trainerBillings.billing_period_id],
    references: [billingPeriods.id],
  }),
  trainer: one(trainers, {
    fields: [trainerBillings.trainer_id],
    references: [trainers.id],
  }),
  lineItems: many(billingLineItems),
}));

export const billingLineItemsRelations = relations(billingLineItems, ({ one }) => ({
  trainerBilling: one(trainerBillings, {
    fields: [billingLineItems.trainer_billing_id],
    references: [trainerBillings.id],
  }),
  session: one(sessions, {
    fields: [billingLineItems.session_id],
    references: [sessions.id],
  }),
}));

// ==============================================================================
// Hours Log & Attendance Tables
// ==============================================================================

/**
 * Hours logs (trainer time tracking)
 */
export const hoursLogs = pgTable(
  'hours_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'restrict' }),
    trainer_name: varchar('trainer_name', { length: 255 }).notNull(),
    session_id: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    start_time: varchar('start_time', { length: 5 }).notNull(), // HH:MM format
    end_time: varchar('end_time', { length: 5 }).notNull(), // HH:MM format
    duration: integer('duration').notNull(), // in minutes
    type: varchar('type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    notes: text('notes'),
    approved_by: varchar('approved_by', { length: 100 }),
    approved_at: timestamp('approved_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    trainer_idx: index('hours_logs_trainer_idx').on(table.trainer_id),
    session_idx: index('hours_logs_session_idx').on(table.session_id),
    date_idx: index('hours_logs_date_idx').on(table.date),
    status_idx: index('hours_logs_status_idx').on(table.status),
  })
);

/**
 * Attendance records (session participant tracking)
 */
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    session_id: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'restrict' }),
    trainer_name: varchar('trainer_name', { length: 255 }).notNull(),
    participant_id: uuid('participant_id').notNull(),
    participant_name: varchar('participant_name', { length: 255 }).notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    check_in_time: varchar('check_in_time', { length: 5 }), // HH:MM format
    check_out_time: varchar('check_out_time', { length: 5 }), // HH:MM format
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    session_idx: index('attendance_records_session_idx').on(table.session_id),
    trainer_idx: index('attendance_records_trainer_idx').on(table.trainer_id),
    participant_idx: index('attendance_records_participant_idx').on(table.participant_id),
    date_idx: index('attendance_records_date_idx').on(table.date),
  })
);

// Relations
export const hoursLogsRelations = relations(hoursLogs, ({ one }) => ({
  trainer: one(trainers, {
    fields: [hoursLogs.trainer_id],
    references: [trainers.id],
  }),
  session: one(sessions, {
    fields: [hoursLogs.session_id],
    references: [sessions.id],
  }),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  session: one(sessions, {
    fields: [attendanceRecords.session_id],
    references: [sessions.id],
  }),
  trainer: one(trainers, {
    fields: [attendanceRecords.trainer_id],
    references: [trainers.id],
  }),
}));

// ==============================================================================
// Session RSVPs (member attendance confirmation for training sessions)
// ==============================================================================

export const sessionRsvps = pgTable(
  'session_rsvps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    session_id: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    responded_at: timestamp('responded_at', { withTimezone: true }),
    notes: text('notes'),
    reminded_at: timestamp('reminded_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    session_member_idx: index('rsvp_session_member_idx').on(table.session_id, table.member_id),
    member_idx: index('rsvp_member_idx').on(table.member_id),
    status_idx: index('rsvp_status_idx').on(table.status),
    session_status_idx: index('rsvp_session_status_idx').on(table.session_id, table.status),
    club_idx: index('rsvp_club_idx').on(table.club_id),
  })
);

export const sessionRsvpsRelations = relations(sessionRsvps, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionRsvps.session_id],
    references: [sessions.id],
  }),
  member: one(users, {
    fields: [sessionRsvps.member_id],
    references: [users.id],
  }),
  club: one(clubs, {
    fields: [sessionRsvps.club_id],
    references: [clubs.id],
  }),
}));

// ==============================================================================
// Trainer Availability Table
// ==============================================================================

/**
 * Trainer availability slots (when trainers are available/unavailable)
 */
export const trainerAvailabilities = pgTable(
  'trainer_availabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    start_time: varchar('start_time', { length: 5 }).notNull(), // HH:MM format
    end_time: varchar('end_time', { length: 5 }).notNull(), // HH:MM format
    status: varchar('status', { length: 20 }).notNull().default('available'),
    notes: text('notes'),
    recurring_pattern: jsonb('recurring_pattern').$type<{
      type: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval: number;
      endDate?: string;
    }>(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    trainer_idx: index('trainer_availabilities_trainer_idx').on(table.trainer_id),
    date_idx: index('trainer_availabilities_date_idx').on(table.date),
    trainer_date_idx: index('trainer_availabilities_trainer_date_idx').on(
      table.trainer_id,
      table.date
    ),
    status_idx: index('trainer_availabilities_status_idx').on(table.status),
  })
);

// Relations
export const trainerAvailabilitiesRelations = relations(trainerAvailabilities, ({ one }) => ({
  trainer: one(trainers, {
    fields: [trainerAvailabilities.trainer_id],
    references: [trainers.id],
  }),
}));

// ==============================================================================
// Trainer Absences Table
// ==============================================================================

/**
 * Trainer absences (vacation, sick leave, personal time off)
 */
export const trainerAbsences = pgTable(
  'trainer_absences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    trainer_name: varchar('trainer_name', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    start_date: timestamp('start_date', { withTimezone: true, mode: 'date' }).notNull(),
    end_date: timestamp('end_date', { withTimezone: true, mode: 'date' }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    reason: text('reason'),
    notes: text('notes'),
    approved_by: uuid('approved_by'),
    approved_at: timestamp('approved_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    trainer_idx: index('trainer_absences_trainer_idx').on(table.trainer_id),
    club_idx: index('trainer_absences_club_idx').on(table.club_id),
    status_idx: index('trainer_absences_status_idx').on(table.status),
    type_idx: index('trainer_absences_type_idx').on(table.type),
    date_range_idx: index('trainer_absences_date_range_idx').on(table.start_date, table.end_date),
    trainer_dates_idx: index('trainer_absences_trainer_dates_idx').on(
      table.trainer_id,
      table.start_date,
      table.end_date
    ),
    club_dates_idx: index('trainer_absences_club_dates_idx').on(
      table.club_id,
      table.start_date,
      table.end_date
    ),
  })
);

// Relations
export const trainerAbsencesRelations = relations(trainerAbsences, ({ one }) => ({
  trainer: one(trainers, {
    fields: [trainerAbsences.trainer_id],
    references: [trainers.id],
  }),
  club: one(clubs, {
    fields: [trainerAbsences.club_id],
    references: [clubs.id],
  }),
}));

// ==============================================================================
// Fee Configurations Table
// ==============================================================================

/**
 * Fee configurations (pricing rules for memberships, training, courts)
 */
export const feeConfigurations = pgTable(
  'fee_configurations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 20 }).notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    billing_cycle: varchar('billing_cycle', { length: 20 }).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    valid_from: timestamp('valid_from', { withTimezone: true, mode: 'date' }),
    valid_until: timestamp('valid_until', { withTimezone: true, mode: 'date' }),
    conditions: jsonb('conditions')
      .$type<{
        minAge?: number;
        maxAge?: number;
        memberType?: string[];
        trainingGroup?: string[];
      }>()
      .default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('fee_configurations_club_idx').on(table.club_id),
    type_idx: index('fee_configurations_type_idx').on(table.type),
    is_active_idx: index('fee_configurations_is_active_idx').on(table.is_active),
    billing_cycle_idx: index('fee_configurations_billing_cycle_idx').on(table.billing_cycle),
    validity_idx: index('fee_configurations_validity_idx').on(table.valid_from, table.valid_until),
    club_active_idx: index('fee_configurations_club_active_idx').on(table.club_id, table.is_active),
    club_type_idx: index('fee_configurations_club_type_idx').on(table.club_id, table.type),
  })
);

// Relations
export const feeConfigurationsRelations = relations(feeConfigurations, ({ one }) => ({
  club: one(clubs, {
    fields: [feeConfigurations.club_id],
    references: [clubs.id],
  }),
}));

// ==============================================================================
// Payment Settings Table
// ==============================================================================

/**
 * Payment gateway configurations (Stripe, PayPal, SEPA, Cash)
 */
export const paymentSettings = pgTable(
  'payment_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    gateway: varchar('gateway', { length: 20 }).notNull(),
    gateway_name: varchar('gateway_name', { length: 100 }).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    is_default: boolean('is_default').notNull().default(false),
    config: jsonb('config')
      .$type<{
        apiKey?: string;
        publicKey?: string;
        secretKey?: string;
        merchantId?: string;
        webhookUrl?: string;
        [key: string]: string | undefined;
      }>()
      .notNull()
      .default({}),
    supported_currencies: text('supported_currencies').array().notNull(),
    supported_methods: text('supported_methods').array().notNull(),
    min_amount: numeric('min_amount', { precision: 10, scale: 2 }),
    max_amount: numeric('max_amount', { precision: 10, scale: 2 }),
    fees: jsonb('fees')
      .$type<{
        fixed?: number;
        percentage?: number;
      }>()
      .default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('payment_settings_club_idx').on(table.club_id),
    gateway_idx: index('payment_settings_gateway_idx').on(table.gateway),
    is_active_idx: index('payment_settings_is_active_idx').on(table.is_active),
    default_idx: index('payment_settings_default_idx').on(table.club_id, table.is_default),
    club_active_idx: index('payment_settings_club_active_idx').on(table.club_id, table.is_active),
  })
);

// Relations
export const paymentSettingsRelations = relations(paymentSettings, ({ one }) => ({
  club: one(clubs, {
    fields: [paymentSettings.club_id],
    references: [clubs.id],
  }),
}));

// ==============================================================================
// System Settings Table
// ==============================================================================

/**
 * System settings (global and club-specific configuration)
 */
export const systemSettings = pgTable(
  'system_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 20 }).notNull(),
    key: varchar('key', { length: 100 }).notNull(),
    value: text('value').notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    description: text('description'),
    is_public: boolean('is_public').notNull().default(false),
    is_required: boolean('is_required').notNull().default(false),
    validation: jsonb('validation')
      .$type<{
        min?: number;
        max?: number;
        pattern?: string;
        enum?: string[];
      }>()
      .default({}),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updated_by: uuid('updated_by'),
  },
  (table) => ({
    club_idx: index('system_settings_club_idx').on(table.club_id),
    category_idx: index('system_settings_category_idx').on(table.category),
    key_idx: index('system_settings_key_idx').on(table.key),
    is_public_idx: index('system_settings_is_public_idx').on(table.is_public),
    club_category_idx: index('system_settings_club_category_idx').on(table.club_id, table.category),
    club_key_idx: index('system_settings_club_key_idx').on(table.club_id, table.key),
  })
);

// Relations
export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  club: one(clubs, {
    fields: [systemSettings.club_id],
    references: [clubs.id],
  }),
}));

// ==============================================================================
// SEPA Mandate Management
// ==============================================================================

/**
 * SEPA direct debit mandates for member payments
 */
export const sepaMandates = pgTable(
  'sepa_mandates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').notNull(),
    accountHolder: varchar('account_holder', { length: 200 }).notNull(),
    iban: varchar('iban', { length: 34 }).notNull(),
    bic: varchar('bic', { length: 11 }).notNull(),
    bankName: varchar('bank_name', { length: 200 }).notNull(),
    address: jsonb('address')
      .$type<{
        street: string;
        houseNumber: string;
        postalCode: string;
        city: string;
      }>()
      .notNull(),
    mandateReference: varchar('mandate_reference', { length: 50 }).notNull().unique(),
    creditorId: varchar('creditor_id', { length: 35 }).notNull().default('DE98ZZZ00000000000'),
    signatureDate: varchar('signature_date', { length: 10 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    revokedAt: varchar('revoked_at', { length: 30 }),
    revokeReason: text('revoke_reason'),
    createdAt: varchar('created_at', { length: 30 }).notNull(),
  },
  (table) => ({
    club_idx: index('sepa_mandates_club_idx').on(table.clubId),
    member_idx: index('sepa_mandates_member_idx').on(table.memberId),
    active_idx: index('sepa_mandates_is_active_idx').on(table.isActive),
  })
);

// Relations
export const sepaMandatesRelations = relations(sepaMandates, ({ one }) => ({
  club: one(clubs, {
    fields: [sepaMandates.clubId],
    references: [clubs.id],
  }),
}));

// ==============================================================================
// Hourly Rate Management Tables
// ==============================================================================

/**
 * Hourly rate tiers for different training types and experience levels
 */
export const hourlyRateTiers = pgTable(
  'hourly_rate_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    baseRate: numeric('base_rate', { precision: 10, scale: 2 }).notNull(),
    trainingTypes: jsonb('training_types').$type<string[]>().notNull().default([]),
    experienceLevel: varchar('experience_level', { length: 20 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('hourly_rate_tiers_club_idx').on(table.club_id),
    active_idx: index('hourly_rate_tiers_is_active_idx').on(table.isActive),
    experience_idx: index('hourly_rate_tiers_experience_level_idx').on(table.experienceLevel),
  })
);

/**
 * Individual trainer hourly rates with validity periods
 */
export const trainerHourlyRates = pgTable(
  'trainer_hourly_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    trainerId: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    trainerName: varchar('trainer_name', { length: 100 }).notNull(),
    baseRate: numeric('base_rate', { precision: 10, scale: 2 }).notNull(),
    overrideRate: numeric('override_rate', { precision: 10, scale: 2 }),
    effectiveRate: numeric('effective_rate', { precision: 10, scale: 2 }).notNull(),
    validFrom: varchar('valid_from', { length: 10 }).notNull(),
    validUntil: varchar('valid_until', { length: 10 }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('trainer_hourly_rates_club_idx').on(table.club_id),
    trainer_idx: index('trainer_hourly_rates_trainer_idx').on(table.trainerId),
    valid_from_idx: index('trainer_hourly_rates_valid_from_idx').on(table.validFrom),
  })
);

/**
 * Audit trail for trainer rate changes
 */
export const rateHistory = pgTable(
  'rate_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    trainerId: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    trainerName: varchar('trainer_name', { length: 100 }).notNull(),
    oldRate: numeric('old_rate', { precision: 10, scale: 2 }).notNull(),
    newRate: numeric('new_rate', { precision: 10, scale: 2 }).notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    changedBy: varchar('changed_by', { length: 100 }).notNull(),
    reason: text('reason'),
  },
  (table) => ({
    club_idx: index('rate_history_club_idx').on(table.club_id),
    trainer_idx: index('rate_history_trainer_idx').on(table.trainerId),
    changed_at_idx: index('rate_history_changed_at_idx').on(table.changedAt),
  })
);

// Relations
export const hourlyRateTiersRelations = relations(hourlyRateTiers, ({ one }) => ({
  club: one(clubs, {
    fields: [hourlyRateTiers.club_id],
    references: [clubs.id],
  }),
}));

export const trainerHourlyRatesRelations = relations(trainerHourlyRates, ({ one }) => ({
  club: one(clubs, {
    fields: [trainerHourlyRates.club_id],
    references: [clubs.id],
  }),
  trainer: one(trainers, {
    fields: [trainerHourlyRates.trainerId],
    references: [trainers.id],
  }),
}));

export const rateHistoryRelations = relations(rateHistory, ({ one }) => ({
  club: one(clubs, {
    fields: [rateHistory.club_id],
    references: [clubs.id],
  }),
  trainer: one(trainers, {
    fields: [rateHistory.trainerId],
    references: [trainers.id],
  }),
}));

// ==============================================================================
// Trainer Profiles Table
// ==============================================================================

/**
 * Comprehensive trainer profile information with qualifications and specializations
 */
export const trainerProfiles = pgTable(
  'trainer_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull(),
    first_name: varchar('first_name', { length: 100 }).notNull(),
    last_name: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).notNull(),
    dateOfBirth: varchar('date_of_birth', { length: 10 }).notNull(),
    bio: text('bio'),
    profileImageUrl: text('profile_image_url'),
    // Complex JSONB fields
    qualifications: jsonb('qualifications')
      .$type<
        Array<{
          id: string;
          name: string;
          issuer: string;
          issuedDate: string;
          expiryDate?: string;
          certificateUrl?: string;
          verified: boolean;
          verifiedAt?: string;
          verifiedBy?: string;
        }>
      >()
      .notNull()
      .default([]),
    specializations: jsonb('specializations')
      .$type<
        Array<{
          id: string;
          name: string;
          level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
        }>
      >()
      .notNull()
      .default([]),
    experience: jsonb('experience')
      .$type<{
        years: number;
        previousClubs: string[];
        achievements: string[];
      }>()
      .notNull()
      .default({ years: 0, previousClubs: [], achievements: [] }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
    availability: jsonb('availability')
      .$type<{
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean;
        sunday: boolean;
      }>()
      .notNull()
      .default({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      }),
    preferredTimeSlots: jsonb('preferred_time_slots')
      .$type<
        Array<{
          start: string;
          end: string;
        }>
      >()
      .notNull()
      .default([]),
    languages: jsonb('languages').$type<string[]>().notNull().default(['Deutsch']),
    emergencyContact: jsonb('emergency_contact')
      .$type<{
        name: string;
        phone: string;
        relationship: string;
      }>()
      .notNull()
      .default({ name: '', phone: '', relationship: '' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('trainer_profiles_club_idx').on(table.club_id),
    user_idx: index('trainer_profiles_user_idx').on(table.user_id),
    status_idx: index('trainer_profiles_status_idx').on(table.status),
    email_idx: index('trainer_profiles_email_idx').on(table.email),
    club_status_idx: index('trainer_profiles_club_status_idx').on(table.club_id, table.status),
  })
);

// Relations
export const trainerProfilesRelations = relations(trainerProfiles, ({ one }) => ({
  club: one(clubs, {
    fields: [trainerProfiles.club_id],
    references: [clubs.id],
  }),
}));

// ==============================================================================
// Trial Trainings Table
// ==============================================================================

/**
 * Trial training sessions (participant tracking, conversion metrics)
 */
export const trialTrainings = pgTable(
  'trial_trainings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    // Participant
    participant_id: uuid('participant_id').notNull().defaultRandom(),
    participant_first_name: varchar('participant_first_name', { length: 100 }).notNull(),
    participant_last_name: varchar('participant_last_name', { length: 100 }).notNull(),
    participant_email: varchar('participant_email', { length: 255 }).notNull(),
    participant_phone: varchar('participant_phone', { length: 50 }).notNull(),
    participant_date_of_birth: timestamp('participant_date_of_birth', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    // Scheduling
    scheduled_date: timestamp('scheduled_date', { withTimezone: true, mode: 'date' }).notNull(),
    scheduled_time: varchar('scheduled_time', { length: 5 }).notNull(),
    duration: integer('duration').notNull(),
    // Resources
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'restrict' }),
    trainer_name: varchar('trainer_name', { length: 100 }).notNull(),
    court_id: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'restrict' }),
    court_name: varchar('court_name', { length: 100 }).notNull(),
    // Status & Notes
    status: varchar('status', { length: 20 }).notNull().default('scheduled'),
    notes: text('notes'),
    // Feedback
    feedback_rating: integer('feedback_rating'),
    feedback_comments: text('feedback_comments'),
    feedback_would_recommend: boolean('feedback_would_recommend'),
    // Conversion
    converted_to_member_id: uuid('converted_to_member_id'),
    // Timestamps
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('trial_trainings_club_idx').on(table.club_id),
    participant_email_idx: index('trial_trainings_participant_email_idx').on(
      table.participant_email
    ),
    trainer_idx: index('trial_trainings_trainer_idx').on(table.trainer_id),
    court_idx: index('trial_trainings_court_idx').on(table.court_id),
    status_idx: index('trial_trainings_status_idx').on(table.status),
    scheduled_date_idx: index('trial_trainings_scheduled_date_idx').on(table.scheduled_date),
    club_status_idx: index('trial_trainings_club_status_idx').on(table.club_id, table.status),
    club_date_idx: index('trial_trainings_club_date_idx').on(table.club_id, table.scheduled_date),
  })
);

// Relations
export const trialTrainingsRelations = relations(trialTrainings, ({ one }) => ({
  club: one(clubs, {
    fields: [trialTrainings.club_id],
    references: [clubs.id],
  }),
  trainer: one(trainers, {
    fields: [trialTrainings.trainer_id],
    references: [trainers.id],
  }),
  court: one(courts, {
    fields: [trialTrainings.court_id],
    references: [courts.id],
  }),
}));
