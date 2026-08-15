// F7: Architekturentscheid Schema-Drift
// Migrationen (supabase/migrations/) = einzige Quelle der Wahrheit.
// Drizzle = Teilabbild (~38 von ~105 Tabellen) — nur für typisierte Queries genutzt.
// Neue Tabellen: erst Migration, Drizzle-Eintrag optional wenn Route ihn braucht.

import {
  pgTable,
  timestamp,
  date,
  time,
  boolean,
  jsonb,
  uuid,
  varchar,
  integer,
  smallint,
  numeric,
  index,
  text,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';

type OfficeFlagMap = Record<string, boolean>;

// A2-Vertrag: user_club_memberships.office_flags ist JSONB mit Shape
// OfficeFlagMap = Partial<Record<OfficeRole, boolean>>. Der Migration-SQL ist
// in 20260625_office_flags.sql bereits live — Drizzle-Sync nur TS-Layer.

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
    // city: varchar(200) ist seit den ursprünglichen Vereins-Migrations in der DB
    // vorhanden, war aber bislang nicht im Drizzle-Abbild. Owner-Master-Drawer
    // (Phase 2) patcht das Feld — daher jetzt ergänzt.
    city: varchar('city', { length: 200 }),
    logo_url: text('logo_url'),
    description: text('description'),
    founding_date: timestamp('founding_date', { mode: 'date' }),
    bundesland: varchar('bundesland', { length: 50 }),
    billing_unit_minutes: integer('billing_unit_minutes').default(60),
    tax_rate: integer('tax_rate').default(0),
    default_payment_method: varchar('default_payment_method', { length: 20 }).default('transfer'),
    invoice_number_prefix: varchar('invoice_number_prefix', { length: 10 }),
    // F1.1 DATEV: Per-Verein Default-Erlöskonto (SKR03/04). Default '4000' für SKR04.
    default_revenue_account: text('default_revenue_account').notNull().default('4000'),
    // Per-club feature flags. Keys defined in lib/features.ts.
    // Core features (members, trainers, seasons, finance) are immutable and always true.
    features: jsonb('features').$type<Record<string, boolean>>().notNull().default({
      members: true,
      trainers: true,
      seasons: true,
      finance: true,
      shop: false,
      tournaments: false,
      trial_training: false,
      partner_finder: false,
      weather_integration: false,
      league_lineup: false,
      work_duty: false,
      dynamic_pricing: false,
    }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    // Phase 1 Soft-Delete: deleted_at/deleted_by/deletion_reason über
    // Migration 20260803 angelegt. Drizzle hier als TS-Abbild. Owner sieht
    // status='deleted' Einträge; alle anderen Rollen via RLS gefiltert.
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    deleted_by: uuid('deleted_by').references(() => users.id),
    deletion_reason: text('deletion_reason'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    name_idx: index('name_idx').on(table.name),
  })
);

export const trainers = pgTable(
  'trainers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id'),
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
    court_type_id: uuid('court_type_id'),
    has_lighting: boolean('has_lighting').default(false),
    number: integer('number'),
    location: text('location'),
    description: text('description'),
    status: text('status').default('active'),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    usable_for_training: boolean('usable_for_training').notNull().default(true),
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
    // Q2-Audit: optionale individuelle Kapazität; NULL = globaler Default aus
    // season_planning_configs (group_max_size / kids_group_max_size).
    max_size: integer('max_size'),
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
    name: varchar('name', { length: 200 }),
    description: text('description'),
    min_booking_hours: numeric('min_booking_hours', { precision: 5, scale: 2 }).default('1'),
    max_booking_hours: numeric('max_booking_hours', { precision: 5, scale: 2 }).default('4'),
    price_per_hour: numeric('price_per_hour', { precision: 10, scale: 2 }).notNull(),
    advance_booking_days: integer('advance_booking_days').default(7),
    applies_to_member_types: jsonb('applies_to_member_types').$type<string[]>().default([]), // [] = all
    applies_to_groups: jsonb('applies_to_groups').$type<string[]>().default([]), // [] = all
    // P2 #11: Dynamic Pricing — time-of-day, day-of-week, season
    time_ranges: jsonb('time_ranges')
      .$type<Array<{ start: string; end: string; priceMultiplier: number }>>()
      .default([]),
    days_of_week: integer('days_of_week').array(),
    season_id: uuid('season_id'),
    valid_from: timestamp('valid_from', { withTimezone: true }),
    valid_until: timestamp('valid_until', { withTimezone: true }),
    priority: integer('priority').notNull().default(0), // higher = more specific, wins over lower
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('pricing_rules_club_idx').on(table.club_id),
    court_idx: index('pricing_rules_court_idx').on(table.court_id),
    club_priority_idx: index('pricing_rules_club_priority_idx').on(table.club_id, table.priority),
    season_idx: index('pricing_rules_season_id_idx').on(table.season_id),
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
    cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
    cancellation_reason: text('cancellation_reason'),
    // Rückverweis zur Saisonplanungs-Vorlage — ermöglicht dem Reschedule-Endpoint,
    // alle künftigen Sessions einer Gruppe wiederzufinden, wenn Zeit/Trainer/Platz
    // mitten in der Saison geändert werden.
    plan_entry_id: uuid('plan_entry_id').references((): AnyPgColumn => seasonPlanEntries.id, {
      onDelete: 'set null',
    }),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    schedule_idx: index('sessions_schedule_idx').on(table.schedule_id),
    trainer_idx: index('sessions_trainer_idx').on(table.trainer_id),
    court_idx: index('sessions_court_idx').on(table.court_id),
    week_idx: index('sessions_week_idx').on(table.week_number),
    plan_entry_idx: index('sessions_plan_entry_idx').on(table.plan_entry_id),
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
    court_id: uuid('court_id').notNull(),
    booking_number: text('booking_number'),
    booking_type: text('booking_type').default('court'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    booked_at: timestamp('booked_at').notNull().defaultNow(),
    session_start_time: timestamp('session_start_time', { withTimezone: true }).notNull(),
    start_time: timestamp('start_time', { withTimezone: true }),
    end_time: timestamp('end_time', { withTimezone: true }),
    is_recurring: boolean('is_recurring').default(false),
    payment_status: text('payment_status').default('pending'),
    cancelled_at: timestamp('cancelled_at'),
    cancellation_reason: varchar('cancellation_reason', { length: 50 }),
    cancellation_notes: text('cancellation_notes'),
    notes: text('notes'),
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
    // 3.6.1 Pay-per-Active-Member-Pricing — Stripe quantity idempotency cache.
    // See supabase/migrations/20260628_add_stripe_quantity_sync.sql
    // (lib/services/stripe-subscription-quantity-sync.service.ts).
    stripe_subscription_quantity_synced: integer('stripe_subscription_quantity_synced'),
    stripe_subscription_quantity_synced_at: timestamp('stripe_subscription_quantity_synced_at', {
      withTimezone: true,
    }),
    current_period_end: timestamp('current_period_end'),
    // Season planning fields
    experience_months: integer('experience_months').default(0),
    skill_level: varchar('skill_level', { length: 20 }).default('beginner'),
    // Existiert in der Live-DB, war im Drizzle-Schema aber nicht abgebildet.
    // Die Saisonplanung braucht es, um Minderjährige zu erkennen (Schulzeiten,
    // späteste Trainingszeit) — vorher wurde das aus dem Wunschfeld
    // `preferred_age_group` geraten, das ohne Präferenzen leer ist.
    date_of_birth: date('date_of_birth'),
    // Superadmin onboarding completion flag (person-bound, not club-bound)
    superadmin_setup_completed_at: timestamp('superadmin_setup_completed_at'),
    //    DTB-ID: Deutsche Tennis Bund Spielernummer für tennis.de Integration
    dtb_id: varchar('dtb_id', { length: 20 }),
    // F1.1 DATEV: Per-Mitglied-Debitoren-Nummer (z. B. „10042"). NULL = Fallback auf ENV-Default.
    datev_debitor_number: text('datev_debitor_number'),
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
    // Soft-Delete-Metadaten, gesetzt von app/api/members/[id]/route.ts (DELETE).
    // Nachgezogen aus der DB — Spalten existierten dort bereits vor diesem Fix.
    deactivated_at: timestamp('deactivated_at'),
    deactivated_by: uuid('deactivated_by'),
    include_in_planning: boolean('include_in_planning').notNull().default(true),
    // A2 — Funktionale Vereinsämter (Host-Flag-System, komplement\u00e4r zur Rolle).
    // Keys + Typen definiert in `lib/auth-common.ts` (`OfficeRole` / `OfficeFlagMap`).
    // Bestehende Migration `20260625_office_flags.sql` hat die JSONB-Spalte bereits angelegt.
    // Hier nur nachgezogen, damit typisierte Queries ohne `as unknown`-Cast funktionieren.
    // Verteidigung: `sanitizeOfficeFlags` in `lib/auth-common.ts` filtert unbekannte Keys,
    // bevor sie in den Map-Lookup in `verifyOffice` gehen.
    office_flags: jsonb('office_flags').$type<OfficeFlagMap>().notNull().default({}),
    tenant_id: varchar('tenant_id', { length: 100 }), // Für Multi-Tenant Isolation
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    user_club_unique: { unique: true, columns: [table.user_id, table.club_id] },
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
    // F6.3 — composite covering the AnonymizeService DSGVO idempotency query
    // WHERE action=X AND resource_type=Y AND resource_id=Z. Created by
    // supabase/migrations/20260626_audit_logs_dsgvo_idx.sql.
    action_resource_type_id_idx: index('audit_logs_action_resource_type_id_idx').on(
      table.action,
      table.resource_type,
      table.resource_id
    ),
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
    member_id: uuid('member_id'),
    trainer_id: uuid('trainer_id'),
    invoice_number: text('invoice_number').notNull(),
    invoice_type: text('invoice_type'),
    due_date: timestamp('due_date', { mode: 'date' }).notNull(),
    status: text('status').notNull().default('draft'),
    invoice_date: date('invoice_date').notNull().defaultNow(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('0'),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
    tax_amount: numeric('tax_amount', { precision: 10, scale: 2 }),
    paid_amount: numeric('paid_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('EUR'),
    notes: text('notes'),
    season_id: uuid('season_id'),
    sent_at: timestamp('sent_at', { withTimezone: true }),
    paid_at: timestamp('paid_at', { withTimezone: true }),
    cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
    cancellation_reason: varchar('cancellation_reason', { length: 50 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
    quantity: numeric('quantity').notNull().default('1'),
    unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    tax_rate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('19'),
    total_price: numeric('total_price', { precision: 10, scale: 2 }),
    item_type: varchar('item_type', { length: 20 }).notNull(),
    reference_id: uuid('reference_id'),
    reference_type: varchar('reference_type', { length: 50 }),
    datev_account_number: text('datev_account_number'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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

// ==============================================================================
// Dunning Records — Mahnwesen
// ==============================================================================

/**
 * Dunning records (Mahnläufe) for overdue invoices.
 * Linked to invoices; club_id enables multi-tenant isolation / RLS.
 */
export const dunningRecords = pgTable(
  'dunning_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoice_id: uuid('invoice_id').notNull(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id'),
    level: smallint('level').default(1),
    status: varchar('status', { length: 20 }).default('sent'),
    original_amount: numeric('original_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    due_date: date('due_date'),
    fee_amount: numeric('fee_amount', { precision: 10, scale: 2 }).default('0'),
    sent_at: timestamp('sent_at', { withTimezone: true }).defaultNow(),
    paid_at: timestamp('paid_at', { withTimezone: true }),
    escalated_at: timestamp('escalated_at', { withTimezone: true }),
    cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    club_idx: index('dunning_records_club_idx').on(table.club_id),
    member_idx: index('dunning_records_member_idx').on(table.member_id),
    invoice_idx: index('dunning_records_invoice_idx').on(table.invoice_id),
    status_idx: index('dunning_records_status_idx').on(table.status),
    level_idx: index('dunning_records_level_idx').on(table.level),
  })
);

export const dunningRecordsRelations = relations(dunningRecords, ({ one }) => ({
  club: one(clubs, {
    fields: [dunningRecords.club_id],
    references: [clubs.id],
  }),
  invoice: one(invoices, {
    fields: [dunningRecords.invoice_id],
    references: [invoices.id],
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
    // Live sind diese Spalten vom Typ `date`, nicht `timestamp` (geprüft über
    // information_schema). Als timestamp deklariert lieferte Drizzle für beide
    // `null` — die Veröffentlichung fiel damit auf ihre Notnagel-Werte zurück
    // (Saisonstart = heute, Ende = heute + 90 Tage) und legte die Trainings-
    // termine einer Wintersaison auf August bis November.
    start_date: date('start_date', { mode: 'date' }).notNull(),
    end_date: date('end_date', { mode: 'date' }).notNull(),

    // Planning status
    planning_status: varchar('planning_status', { length: 30 }).notNull().default('draft'),

    // Preferences collection
    preferences_deadline: date('preferences_deadline', { mode: 'date' }),
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
    // Avoid partners (member IDs they do NOT want to be grouped with)
    avoid_member_ids: jsonb('avoid_member_ids').$type<string[]>().default([]),
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
    // FK points to the modern seasonal `groups` table (member_ids JSONB, created by
    // SeasonClusteringEngine). NOT the legacy `training_groups` table (`schedule_id`
    // NOT NULL, designed for fixed schedules — incompatible with clustering-driven groups).
    // See supabase/migrations/20260630_recorrect_season_plan_entries_group_fk.sql
    // for the matching DB-level FK correction (drizzle/0010 had pointed to the wrong table).
    group_id: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),

    // Timing (recurring weekly pattern)
    day_of_week: integer('day_of_week').notNull(),
    start_time: time('start_time').notNull(), // "HH:MM:SS"
    end_time: time('end_time').notNull(),
    duration_minutes: integer('duration_minutes').notNull(),

    // Mehrfach-Training: 1 = einmal/Woche (Standard), 2 = zweimal/Woche
    // Bei sessions_per_week=2 nutzt day_of_week_2 den zweiten Termin (default: day_of_week+3).
    sessions_per_week: integer('sessions_per_week').notNull().default(1),
    day_of_week_2: integer('day_of_week_2'),

    // Trainer-Vertretung: ab substitute_from_week bis substitute_to_week übernimmt substitute_trainer_id
    substitute_trainer_id: uuid('substitute_trainer_id').references(() => trainers.id, {
      onDelete: 'set null',
    }),
    substitute_from_week: integer('substitute_from_week'),
    substitute_to_week: integer('substitute_to_week'),

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
    // F2: Übungsleiterpauschale (§ 3 Nr. 26 EStG) — steuerfreier Anteil, max. 3.000 € p.a. pro Trainer
    tax_free_amount: numeric('tax_free_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    // F2: Steuerpflichtiger Anteil (Betrag über der Übungsleiterpauschale)
    taxable_amount: numeric('taxable_amount', { precision: 10, scale: 2 }).notNull().default('0'),
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
    rejection_reason: text('rejection_reason'),
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
    // Confirmation fields (Stundenbestätigung)
    trainer_confirmed: boolean('trainer_confirmed').notNull().default(false),
    trainer_confirmed_at: timestamp('trainer_confirmed_at', { withTimezone: true }),
    member_status: varchar('member_status', { length: 20 }).notNull().default('pending'),
    member_confirmed_at: timestamp('member_confirmed_at', { withTimezone: true }),
    dispute_reason: text('dispute_reason'),
    dispute_resolved_at: timestamp('dispute_resolved_at', { withTimezone: true }),
    dispute_resolved_by: uuid('dispute_resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    duration_minutes: integer('duration_minutes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    session_idx: index('attendance_records_session_idx').on(table.session_id),
    trainer_idx: index('attendance_records_trainer_idx').on(table.trainer_id),
    participant_idx: index('attendance_records_participant_idx').on(table.participant_id),
    date_idx: index('attendance_records_date_idx').on(table.date),
    trainer_confirmed_idx: index('attendance_records_trainer_confirmed_idx').on(
      table.trainer_confirmed
    ),
    member_status_idx: index('attendance_records_member_status_idx').on(table.member_status),
    participant_member_status_idx: index('attendance_records_participant_member_status_idx').on(
      table.participant_id,
      table.member_status
    ),
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
// ==============================================================================
// Trainer Availability (singular) — user_id + day_of_week based
// Used by Supabase-based trainer availability API routes
// ==============================================================================

/**
 * Trainer availability by day-of-week pattern (simpler model than the date-based
 * trainer_availabilities table). Used by /api/trainer/availability endpoints.
 */
export const trainerAvailability = pgTable(
  'trainer_availability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    day_of_week: smallint('day_of_week').notNull(), // 0=Sunday ... 6=Saturday
    start_time: time('start_time').notNull(),
    end_time: time('end_time').notNull(),
    is_available: boolean('is_available').default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    user_idx: index('trainer_availability_user_idx').on(table.user_id),
    day_idx: index('trainer_availability_day_idx').on(table.day_of_week),
  })
);

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
    // Wie bei `seasons`: live `date`, nicht `timestamp` — sonst liest jede
    // Abwesenheitsprüfung (Vertretungsplanung) null statt eines Zeitraums.
    start_date: date('start_date', { mode: 'date' }).notNull(),
    end_date: date('end_date', { mode: 'date' }).notNull(),
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
    dateOfBirth: date('date_of_birth').notNull(),
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
    // Sprint 4 P0 #4 (Dual Hourly Rate): contractually agreed rate + trainer-editable rate
    // for additional hours. See supabase/migrations/20260610_add_trainer_dual_rate.sql
    contracted_hourly_rate: numeric('contracted_hourly_rate', { precision: 10, scale: 2 }),
    extra_hours_rate: numeric('extra_hours_rate', { precision: 10, scale: 2 }),
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
    // Marketing consent (double opt-in) — see 20260730_trial_training_marketing_consent.sql
    marketing_consent: boolean('marketing_consent').notNull().default(false),
    marketing_consent_token: text('marketing_consent_token'),
    marketing_consent_confirmed_at: timestamp('marketing_consent_confirmed_at', {
      withTimezone: true,
    }),
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
    marketing_consent_token_idx: index('trial_trainings_marketing_consent_token_idx').on(
      table.marketing_consent_token
    ),
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

// ==============================================================================
// Member Schedule Preferences Table
// ==============================================================================

/**
 * General (non-season-specific) member schedule preferences.
 * Complements the season-specific user_training_preferences table.
 */
export const memberSchedulePreferences = pgTable(
  'member_schedule_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),

    preferred_level: varchar('preferred_level', { length: 20 }),
    preferred_age_group: varchar('preferred_age_group', { length: 20 }),

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

    wish_partner_ids: jsonb('wish_partner_ids').$type<string[]>().default([]),
    preferred_trainer_ids: jsonb('preferred_trainer_ids').$type<string[]>().default([]),
    preferred_court_ids: jsonb('preferred_court_ids').$type<string[]>().default([]),

    max_sessions_per_week: integer('max_sessions_per_week'),
    special_requests: text('special_requests'),
    notes: text('notes'),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    user_club_unique: { unique: true, columns: [table.user_id, table.club_id] },
    user_idx: index('member_sched_prefs_user_idx').on(table.user_id),
    club_idx: index('member_sched_prefs_club_idx').on(table.club_id),
    level_idx: index('member_sched_prefs_level_idx').on(table.preferred_level),
  })
);

// Relations
export const memberSchedulePreferencesRelations = relations(
  memberSchedulePreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [memberSchedulePreferences.user_id],
      references: [users.id],
    }),
    club: one(clubs, {
      fields: [memberSchedulePreferences.club_id],
      references: [clubs.id],
    }),
  })
);

// ==============================================================================
// Weather Court Closures (SP4: Wetter-Integration)
// ==============================================================================

export const courtClosures = pgTable(
  'court_closures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    court_id: uuid('court_id')
      .notNull()
      .references(() => courts.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 50 }).notNull(), // 'weather', 'maintenance', 'event', 'other'
    description: text('description'),
    start_date: timestamp('start_date', { withTimezone: true }).notNull(),
    end_date: timestamp('end_date', { withTimezone: true }),
    is_active: boolean('is_active').notNull().default(true),
    weather_condition: varchar('weather_condition', { length: 50 }), // 'rain', 'frost', 'extreme_heat', 'snow'
    auto_generated: boolean('auto_generated').notNull().default(false),
    // Gesetzt, wenn die Sperre zu einem Heimspieltag gehört. ON DELETE CASCADE:
    // Spieltag weg ⇒ Platzsperre weg.
    match_day_id: uuid('match_day_id'),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('court_closures_club_idx').on(table.club_id),
    court_idx: index('court_closures_court_idx').on(table.court_id),
    active_idx: index('court_closures_active_idx').on(table.is_active),
    date_range_idx: index('court_closures_date_range_idx').on(table.start_date, table.end_date),
    reason_idx: index('court_closures_reason_idx').on(table.reason),
  })
);

export const courtClosuresRelations = relations(courtClosures, ({ one }) => ({
  club: one(clubs, {
    fields: [courtClosures.club_id],
    references: [clubs.id],
  }),
  court: one(courts, {
    fields: [courtClosures.court_id],
    references: [courts.id],
  }),
  creator: one(users, {
    fields: [courtClosures.created_by],
    references: [users.id],
  }),
}));

// ==============================================================================
// League & Team Lineup (SP5: Liga/Mannschaftsaufstellung)
// ==============================================================================

export const leagues = pgTable(
  'leagues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    season_year: integer('season_year').notNull(),
    league_type: varchar('league_type', { length: 50 }).notNull().default('regular'), // 'regular', 'playoff', 'friendly'
    division: varchar('division', { length: 100 }), // e.g. 'Bezirksliga', 'Kreisklasse'
    sport: varchar('sport', { length: 50 }).notNull().default('tennis'), // 'tennis', 'squash', 'badminton'
    age_group: varchar('age_group', { length: 50 }), // 'Herren', 'Damen', 'Jugend U14', etc.
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'completed', 'archived'
    notes: text('notes'),
    // nuLiga integration
    nuliga_url: text('nuliga_url'),
    // Name der eigenen Mannschaft exakt wie in der nuLiga-Tabelle. Ohne diesen
    // Wert kann der Sync nicht entscheiden, welche Begegnungen unsere sind.
    own_team_name: varchar('own_team_name', { length: 200 }),
    nuliga_roster_url: text('nuliga_roster_url'),
    last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('leagues_club_idx').on(table.club_id),
    season_idx: index('leagues_season_idx').on(table.season_year),
    status_idx: index('leagues_status_idx').on(table.status),
  })
);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    league_id: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    captain_id: uuid('captain_id'),
    position: integer('position'), // current league position
    matches_played: integer('matches_played').notNull().default(0),
    matches_won: integer('matches_won').notNull().default(0),
    matches_lost: integer('matches_lost').notNull().default(0),
    matches_drawn: integer('matches_drawn').notNull().default(0),
    points: integer('points').notNull().default(0),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('teams_club_idx').on(table.club_id),
    league_idx: index('teams_league_idx').on(table.league_id),
    position_idx: index('teams_position_idx').on(table.league_id, table.position),
  })
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    team_id: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id').notNull(),
    role: varchar('role', { length: 20 }).notNull().default('player'), // 'captain', 'player', 'substitute'
    position_number: integer('position_number'), // playing position (1 = first singles, etc.)
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    team_idx: index('team_members_team_idx').on(table.team_id),
    member_idx: index('team_members_member_idx').on(table.member_id),
    team_member_unique: { unique: true, columns: [table.team_id, table.member_id] },
  })
);

export const matchDays = pgTable(
  'match_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    league_id: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    matchday_number: integer('matchday_number').notNull(),
    scheduled_date: timestamp('scheduled_date', { withTimezone: true }),
    opponent: varchar('opponent', { length: 200 }).notNull(),
    is_home: boolean('is_home').notNull().default(true),
    venue: text('venue'),
    result: varchar('result', { length: 20 }), // 'win', 'loss', 'draw', null = not played
    score_home: integer('score_home'),
    score_away: integer('score_away'),
    notes: text('notes'),
    status: varchar('status', { length: 20 }).notNull().default('scheduled'), // 'scheduled', 'in_progress', 'completed', 'cancelled'
    // Link zum nuLiga-Spielbericht — dort stehen die Einzel-/Doppelpaarungen
    // mit Spielernamen. Wir verlinken sie, statt sie zu speichern (DSGVO).
    nuliga_report_url: text('nuliga_report_url'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    league_idx: index('match_days_league_idx').on(table.league_id),
    date_idx: index('match_days_date_idx').on(table.scheduled_date),
    status_idx: index('match_days_status_idx').on(table.status),
  })
);

/**
 * Kader / Meldeliste einer Liga-Mannschaft (aus der nuLiga-Mannschaftsmeldung).
 *
 * Abgrenzung zu `team_members`: dort steht, wer im SwingZ-Verein zu einem Team
 * gehört (interne member_id). Hier steht die beim Verband GEMELDETE Aufstellung
 * inklusive LK und Meldeposition — die Reihenfolge, gegen die eine Aufstellung
 * geprüft werden muss. `member_id` ist die Brücke zwischen beiden, sofern der
 * Name eindeutig zugeordnet werden konnte.
 */
export const leaguePlayers = pgTable(
  'league_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    league_id: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    lk: varchar('lk', { length: 10 }), // Leistungsklasse, z. B. "LK 12,3"
    position_number: integer('position_number'), // Meldeposition (1 = erste Position)
    source_url: text('source_url'),
    synced_at: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('league_players_club_idx').on(table.club_id),
    member_idx: index('league_players_member_idx').on(table.member_id),
  })
);

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  club: one(clubs, {
    fields: [leagues.club_id],
    references: [clubs.id],
  }),
  teams: many(teams),
  matchDays: many(matchDays),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  club: one(clubs, {
    fields: [teams.club_id],
    references: [clubs.id],
  }),
  league: one(leagues, {
    fields: [teams.league_id],
    references: [leagues.id],
  }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.team_id],
    references: [teams.id],
  }),
}));

export const matchDaysRelations = relations(matchDays, ({ one }) => ({
  league: one(leagues, {
    fields: [matchDays.league_id],
    references: [leagues.id],
  }),
}));

// ==============================================================================
// Work Duty Management (LP7: Arbeitsdienst-Verwaltung)
// ==============================================================================

export const workDuties = pgTable(
  'work_duties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    duty_type: varchar('duty_type', { length: 50 }).notNull(), // 'court_maintenance', 'event_support', 'bar_duty', 'cleaning', 'coaching_assist', 'other'
    scheduled_date: timestamp('scheduled_date', { withTimezone: true }),
    start_time: varchar('start_time', { length: 5 }), // HH:MM
    end_time: varchar('end_time', { length: 5 }), // HH:MM
    max_participants: integer('max_participants').default(1),
    status: varchar('status', { length: 20 }).notNull().default('open'), // 'open', 'assigned', 'completed', 'cancelled'
    assigned_to: uuid('assigned_to'), // primary assignee
    priority: varchar('priority', { length: 20 }).notNull().default('medium'), // 'low', 'medium', 'high'
    season_year: integer('season_year'),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    club_idx: index('work_duties_club_idx').on(table.club_id),
    status_idx: index('work_duties_status_idx').on(table.status),
    assigned_idx: index('work_duties_assigned_idx').on(table.assigned_to),
    date_idx: index('work_duties_date_idx').on(table.scheduled_date),
    type_idx: index('work_duties_type_idx').on(table.duty_type),
  })
);

export const workDutyAssignments = pgTable(
  'work_duty_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    duty_id: uuid('duty_id')
      .notNull()
      .references(() => workDuties.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('assigned'), // 'assigned', 'completed', 'excused', 'no_show'
    completed_at: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    duty_idx: index('work_duty_assignments_duty_idx').on(table.duty_id),
    member_idx: index('work_duty_assignments_member_idx').on(table.member_id),
    status_idx: index('work_duty_assignments_status_idx').on(table.status),
    duty_member_unique: { unique: true, columns: [table.duty_id, table.member_id] },
  })
);

export const workDutiesRelations = relations(workDuties, ({ one, many }) => ({
  club: one(clubs, {
    fields: [workDuties.club_id],
    references: [clubs.id],
  }),
  assignments: many(workDutyAssignments),
}));

export const workDutyAssignmentsRelations = relations(workDutyAssignments, ({ one }) => ({
  duty: one(workDuties, {
    fields: [workDutyAssignments.duty_id],
    references: [workDuties.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// Tables added from live Supabase schema (W3 fix)
// ─────────────────────────────────────────────────────────────

export const backgroundJobs = pgTable('background_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_name: text('job_name').notNull(),
  job_type: text('job_type').notNull(),
  status: text('status').notNull(),
  priority: integer('priority').notNull(),
  payload: jsonb('payload'),
  result: jsonb('result'),
  error_message: text('error_message'),
  retry_count: integer('retry_count'),
  max_retries: integer('max_retries'),
  schedule_expression: text('schedule_expression'),
  scheduled_at: text('scheduled_at'),
  started_at: text('started_at'),
  completed_at: text('completed_at'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const bookingRules = pgTable('booking_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id').notNull(),
  name: text('name').notNull(),
  is_active: boolean('is_active'),
  applies_to_role: text('applies_to_role'),
  max_bookings_per_day: integer('max_bookings_per_day'),
  max_bookings_per_week: integer('max_bookings_per_week'),
  max_booking_duration_minutes: integer('max_booking_duration_minutes'),
  min_booking_duration_minutes: integer('min_booking_duration_minutes'),
  advance_booking_days: integer('advance_booking_days'),
  cancellation_hours_before: integer('cancellation_hours_before'),
  require_payment: boolean('require_payment').notNull(),
  allow_recurring: boolean('allow_recurring'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const contactRequests = pgTable('contact_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  club_name: text('club_name'),
  status: text('status').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id'),
  code: text('code').notNull(),
  discount_type: text('discount_type').notNull(),
  discount_value: integer('discount_value').notNull(),
  min_amount: integer('min_amount'),
  max_uses: integer('max_uses'),
  used_count: integer('used_count'),
  expires_at: text('expires_at'),
  is_active: boolean('is_active'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const courtAvailability = pgTable('court_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  court_id: uuid('court_id').notNull(),
  day_of_week: integer('day_of_week').notNull(),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  is_available: boolean('is_available'),
  valid_from: text('valid_from'),
  valid_until: text('valid_until'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const emailCampaigns = pgTable('email_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  target_group: text('target_group'),
  status: text('status'),
  recipient_count: integer('recipient_count'),
  scheduled_at: text('scheduled_at'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const emailQueue = pgTable('email_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaign_id: uuid('campaign_id'),
  club_id: uuid('club_id'),
  recipient_email: text('recipient_email').notNull(),
  recipient_name: text('recipient_name'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status'),
  error_message: text('error_message'),
  sent_at: timestamp('sent_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const familyAccounts = pgTable('family_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  family_group_id: uuid('family_group_id').notNull(),
  role: text('role'),
  relationship: text('relationship'),
  parent_pin_hash: text('parent_pin_hash'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const familyInvites = pgTable('family_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  family_group_id: uuid('family_group_id').notNull(),
  code: text('code').notNull(),
  is_used: boolean('is_used'),
  used_by: text('used_by'),
  expires_at: text('expires_at'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const gamificationBadges = pgTable('gamification_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  earned_at: text('earned_at'),
});

export const gamificationPoints = pgTable('gamification_points', {
  user_id: uuid('user_id').notNull(),
  points: integer('points'),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const invoiceInstallments = pgTable('invoice_installments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoice_id: uuid('invoice_id').notNull(),
  installment_number: integer('installment_number').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  due_date: timestamp('due_date').notNull(),
  status: text('status').notNull(),
  paid_at: timestamp('paid_at'),
  payment_id: uuid('payment_id'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const jobExecutionLog = pgTable('job_execution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_id: uuid('job_id').notNull(),
  execution_started_at: text('execution_started_at').notNull(),
  execution_completed_at: text('execution_completed_at'),
  execution_duration_ms: integer('execution_duration_ms'),
  success: boolean('success').notNull(),
  result: jsonb('result'),
  error_message: text('error_message'),
  stack_trace: text('stack_trace'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const memberBalances = pgTable('member_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  member_id: uuid('member_id').notNull(),
  club_id: uuid('club_id').notNull(),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const memberBalanceEntries = pgTable('member_balance_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  member_balance_id: uuid('member_balance_id').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  reference_type: text('reference_type'),
  reference_id: uuid('reference_id'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sender_id: uuid('sender_id').notNull(),
  receiver_id: uuid('receiver_id').notNull(),
  club_id: uuid('club_id'),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  is_read: boolean('is_read').notNull(),
  read_at: text('read_at'),
  replied_to_id: uuid('replied_to_id'),
  broadcast_type: text('broadcast_type'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const newsComments = pgTable('news_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  post_id: uuid('post_id').notNull(),
  user_id: uuid('user_id').notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const newsPosts = pgTable('news_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id').notNull(),
  author_id: uuid('author_id'),
  title: text('title').notNull(),
  content: text('content'),
  excerpt: text('excerpt'),
  is_published: boolean('is_published'),
  is_pinned: boolean('is_pinned'),
  published_at: text('published_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  club_id: uuid('club_id'),
  title: text('title').notNull(),
  message: text('message'),
  type: text('type'),
  read: boolean('read'),
  action_url: text('action_url'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const nuligaSyncLog = pgTable('nuliga_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id').notNull(),
  league_id: uuid('league_id').notNull(),
  nuliga_url: text('nuliga_url').notNull(),
  nuliga_championship: text('nuliga_championship'),
  nuliga_group_name: text('nuliga_group_name'),
  status: text('status').notNull(),
  trigger: text('trigger').notNull(),
  started_at: text('started_at').notNull(),
  completed_at: text('completed_at').notNull(),
  duration_ms: integer('duration_ms'),
  teams_created: integer('teams_created').notNull(),
  teams_updated: integer('teams_updated').notNull(),
  matches_created: integer('matches_created').notNull(),
  matches_updated: integer('matches_updated').notNull(),
  error_message: text('error_message'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const openMatches = pgTable('open_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id').notNull(),
  creator_id: uuid('creator_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  match_date: date('match_date').notNull(),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  court_id: uuid('court_id'),
  match_type: text('match_type').notNull(),
  skill_level: text('skill_level').notNull(),
  max_players: integer('max_players').notNull(),
  current_players: integer('current_players').notNull(),
  status: text('status').notNull(),
  is_public: boolean('is_public').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const openMatchParticipants = pgTable('open_match_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  match_id: uuid('match_id').notNull(),
  user_id: uuid('user_id').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
  joined_at: text('joined_at').notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoice_id: uuid('invoice_id').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency'),
  payment_method: text('payment_method'),
  status: text('status'),
  external_id: text('external_id'),
  paid_at: timestamp('paid_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  club_id: uuid('club_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  user_agent: text('user_agent'),
  is_active: boolean('is_active').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const qrCheckins = pgTable('qr_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id').notNull(),
  user_id: uuid('user_id').notNull(),
  booking_id: uuid('booking_id'),
  checked_in_at: text('checked_in_at'),
});

export const registrationRequests = pgTable('registration_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id'),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  street: text('street'),
  city: text('city'),
  postal_code: text('postal_code'),
  playing_level: text('playing_level'),
  previous_club: text('previous_club'),
  motivation: text('motivation'),
  wants_trial_training: boolean('wants_trial_training'),
  status: text('status'),
  reviewed_by: text('reviewed_by'),
  reviewed_at: text('reviewed_at'),
  rejection_reason: text('rejection_reason'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const schoolHolidays = pgTable('school_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  bundesland: text('bundesland').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  year: integer('year').notNull(),
});

export const seasonBillingConfigs = pgTable('season_billing_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  season_id: uuid('season_id').notNull(),
  club_id: uuid('club_id').notNull(),
  cost_split_method: text('cost_split_method').notNull(),
  // 'per_session' = Trainer-Stundensatz ÷ Teilnehmer (Standard/Tennisschule)
  // 'membership_included' = Training im Jahresbeitrag, keine Einzelrechnung
  // 'block_of_10' = Zehner-Block-Abrechnung
  billing_model: varchar('billing_model', { length: 30 }).notNull().default('per_session'),
  trainer_hourly_rate: integer('trainer_hourly_rate').notNull(),
  tax_rate: integer('tax_rate').notNull(),
  payment_terms_days: integer('payment_terms_days').notNull(),
  include_membership_fee: boolean('include_membership_fee').notNull(),
  membership_fee_type: text('membership_fee_type'),
  membership_fee_amount: integer('membership_fee_amount'),
  invoice_notes: text('invoice_notes'),
  additional_fees: jsonb('additional_fees'),
  use_trainer_profile_rate: boolean('use_trainer_profile_rate').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const seasonGroupWeeks = pgTable('season_group_weeks', {
  id: uuid('id').primaryKey().defaultRandom(),
  season_id: uuid('season_id').notNull(),
  group_id: uuid('group_id').notNull(),
  club_id: uuid('club_id').notNull(),
  week_number: integer('week_number').notNull(),
  week_monday: text('week_monday').notNull(),
  is_active: boolean('is_active').notNull(),
  reason: text('reason'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const seasonPlanningConfigs = pgTable('season_planning_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  season_id: uuid('season_id'),
  club_id: uuid('club_id').notNull(),
  group_min_size: integer('group_min_size').notNull(),
  group_max_size: integer('group_max_size').notNull(),
  kids_group_min_size: integer('kids_group_min_size').notNull(),
  kids_group_max_size: integer('kids_group_max_size').notNull(),
  slot_duration_minutes: integer('slot_duration_minutes').notNull(),
  ai_clustering_enabled: boolean('ai_clustering_enabled').notNull(),
  prefer_historic_groups: boolean('prefer_historic_groups').notNull(),
  backtrack_depth: integer('backtrack_depth').notNull(),
  waitlist_priority_rule: text('waitlist_priority_rule').notNull(),
  max_niveau_span_beginner_months: integer('max_niveau_span_beginner_months').notNull(),
  max_niveau_span_advanced_months: integer('max_niveau_span_advanced_months').notNull(),
  slot_failure_rate_threshold_pct: integer('slot_failure_rate_threshold_pct').notNull(),
  avoid_high_failure_slots: boolean('avoid_high_failure_slots').notNull(),
  treat_high_failure_as_hard: boolean('treat_high_failure_as_hard').notNull(),
  trainer_utilization_max_pct: integer('trainer_utilization_max_pct').notNull(),
  proven_group_attendance_threshold_pct: integer('proven_group_attendance_threshold_pct').notNull(),
  unassigned_rate_threshold: integer('unassigned_rate_threshold').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const seasonStatistics = pgTable('season_statistics', {
  id: uuid('id').primaryKey().defaultRandom(),
  season_id: uuid('season_id').notNull(),
  club_id: uuid('club_id').notNull(),
  total_members_planned: integer('total_members_planned').notNull(),
  total_groups: integer('total_groups').notNull(),
  preferences_submitted: integer('preferences_submitted').notNull(),
  preferences_total: integer('preferences_total').notNull(),
  total_waitlist_entries: integer('total_waitlist_entries').notNull(),
  total_conflicts_detected: integer('total_conflicts_detected').notNull(),
  conflicts_resolved: integer('conflicts_resolved').notNull(),
  critical_conflicts: integer('critical_conflicts').notNull(),
  niveau_span_violations: integer('niveau_span_violations').notNull(),
  groups_below_min_size: integer('groups_below_min_size').notNull(),
  trainer_burnout_warnings: integer('trainer_burnout_warnings').notNull(),
  level_upgrades_recommended: integer('level_upgrades_recommended').notNull(),
  level_upgrades_applied: integer('level_upgrades_applied').notNull(),
  wish_partner_requests: integer('wish_partner_requests').notNull(),
  wish_partner_fulfilled: integer('wish_partner_fulfilled').notNull(),
  avg_group_size: integer('avg_group_size'),
  avg_niveau_span_months: integer('avg_niveau_span_months'),
  overall_attendance_quote: integer('overall_attendance_quote'),
  preference_satisfaction_score: integer('preference_satisfaction_score'),
  trainer_utilization_avg: integer('trainer_utilization_avg'),
  waitlist_acceptance_rate: integer('waitlist_acceptance_rate'),
  wish_partner_fulfillment_rate: integer('wish_partner_fulfillment_rate'),
  avg_waitlist_duration_days: integer('avg_waitlist_duration_days'),
  slot_failure_rates: jsonb('slot_failure_rates'),
  attendance_by_group: jsonb('attendance_by_group'),
  attendance_by_trainer: jsonb('attendance_by_trainer'),
  computed_at: text('computed_at').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const seasonWaitlists = pgTable('season_waitlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  season_id: uuid('season_id').notNull(),
  group_id: uuid('group_id').notNull(),
  member_id: uuid('member_id').notNull(),
  club_id: uuid('club_id').notNull(),
  position: integer('position').notNull(),
  priority: integer('priority').notNull(),
  priority_reason: text('priority_reason'),
  status: text('status').notNull(),
  registered_at: text('registered_at').notNull(),
  notified_at: text('notified_at'),
  accepted_at: text('accepted_at'),
  alternative_group_id: uuid('alternative_group_id'),
  alternative_assigned_at: text('alternative_assigned_at'),
  notes: text('notes'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const shopProducts = pgTable('shop_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id'),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock'),
  category: text('category'),
  image_url: text('image_url'),
  is_active: boolean('is_active'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const shopOrders = pgTable('shop_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  items: jsonb('items'),
  total_amount: integer('total_amount').notNull(),
  status: text('status'),
  payment_status: text('payment_status'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const trainerFeedback = pgTable('trainer_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  trainer_id: uuid('trainer_id').notNull(),
  member_id: uuid('member_id').notNull(),
  club_id: uuid('club_id').notNull(),
  season_id: uuid('season_id'),
  group_id: uuid('group_id'),
  session_id: uuid('session_id'),
  rating: integer('rating').notNull(),
  teaching_quality: integer('teaching_quality'),
  communication: integer('communication'),
  punctuality: integer('punctuality'),
  motivation: integer('motivation'),
  performance_rating: integer('performance_rating'),
  attendance_quote: integer('attendance_quote'),
  comment: text('comment'),
  notes: text('notes'),
  strengths: jsonb('strengths'),
  areas_for_improvement: jsonb('areas_for_improvement'),
  ready_for_next_level: text('ready_for_next_level'),
  recommended_level: text('recommended_level'),
  is_submitted: boolean('is_submitted').notNull(),
  is_visible: boolean('is_visible'),
  is_flagged: boolean('is_flagged'),
  flagged_reason: text('flagged_reason'),
  submitted_at: text('submitted_at'),
  moderated_at: text('moderated_at'),
  moderated_by: text('moderated_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const trainerRatingSummary = pgTable('trainer_rating_summary', {
  trainer_id: uuid('trainer_id').notNull(),
  club_id: uuid('club_id').notNull(),
  average_rating: integer('average_rating'),
  total_ratings: integer('total_ratings'),
  rating_1_count: integer('rating_1_count'),
  rating_2_count: integer('rating_2_count'),
  rating_3_count: integer('rating_3_count'),
  rating_4_count: integer('rating_4_count'),
  rating_5_count: integer('rating_5_count'),
  avg_teaching_quality: integer('avg_teaching_quality'),
  avg_communication: integer('avg_communication'),
  avg_punctuality: integer('avg_punctuality'),
  avg_motivation: integer('avg_motivation'),
  last_updated: text('last_updated'),
});

export const trainingGroupMemberships = pgTable('training_group_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  training_group_id: uuid('training_group_id').notNull(),
  member_id: uuid('member_id').notNull(),
  club_id: uuid('club_id').notNull(),
  joined_at: text('joined_at').notNull(),
  left_at: text('left_at'),
  left_reason: text('left_reason'),
  created_by: text('created_by'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

// ==============================================================================
// Trainer-Notizen pro Mitglied (#9)
// ==============================================================================

/**
 * Trainer notes per member — only visible to trainers and admins.
 * One note per (trainer, member) pair (upsert pattern).
 */
export const trainerMemberNotes = pgTable(
  'trainer_member_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainer_id: uuid('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id').notNull(),
    club_id: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    trainer_member_unique: { unique: true, columns: [table.trainer_id, table.member_id] },
    member_club_idx: index('idx_trainer_notes_member').on(table.member_id, table.club_id),
  })
);

export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id').notNull(),
  user_id: uuid('user_id').notNull(),
  court_id: uuid('court_id'),
  start_time: text('start_time').notNull(),
  end_time: text('end_time').notNull(),
  priority: integer('priority'),
  status: text('status'),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

// ==============================================================================
// Session Waitlist — Warteliste für Training-Sessions
// ==============================================================================

/**
 * Warteliste für Training-Sessions wenn max_participants erreicht ist.
 * Bei Absagen rückt automatisch der erste Eintrag nach (via Cancel-API).
 */
export const sessionWaitlist = pgTable(
  'session_waitlist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    session_id: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    member_id: uuid('member_id').notNull(),
    club_id: uuid('club_id').notNull(),
    position: integer('position').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    notified_at: timestamp('notified_at', { withTimezone: true }),
  },
  (table) => ({
    session_position_idx: index('session_waitlist_session_position_idx').on(
      table.session_id,
      table.position
    ),
    member_idx: index('session_waitlist_member_idx').on(table.member_id),
    club_idx: index('session_waitlist_club_idx').on(table.club_id),
    unique_session_member: { unique: true, columns: [table.session_id, table.member_id] },
  })
);
