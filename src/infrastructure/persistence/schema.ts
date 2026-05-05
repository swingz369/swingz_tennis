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
    join_date: timestamp('join_date').notNull().defaultNow(),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    club_user_idx: index('club_members_club_user_idx').on(table.club_id, table.user_id),
    user_idx: index('club_members_user_idx').on(table.user_id),
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
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
