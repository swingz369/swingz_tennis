CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"booked_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	"cancellation_reason" varchar(50),
	"cancellation_notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "club_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"join_date" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"max_members" integer DEFAULT 500 NOT NULL,
	"opening_hours" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"surface" varchar(20) DEFAULT 'hard' NOT NULL,
	"has_indoor" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"season_type" varchar(20) NOT NULL,
	"season_year" integer NOT NULL,
	"season_start_date" timestamp NOT NULL,
	"season_end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"trainer_id" uuid NOT NULL,
	"group_ids" jsonb NOT NULL,
	"week_number" integer NOT NULL,
	"timeslot_start" timestamp NOT NULL,
	"timeslot_end" timestamp NOT NULL,
	"court_id" uuid,
	"max_participants" integer DEFAULT 10 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trainer_club" (
	"trainer_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_hours_per_week" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trainers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"level" varchar(20) DEFAULT 'intermediate' NOT NULL,
	"age_group" varchar(20) DEFAULT 'senior' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_club_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"tenant_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(100),
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courts" ADD CONSTRAINT "courts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedules" ADD CONSTRAINT "schedules_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trainer_club" ADD CONSTRAINT "trainer_club_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trainer_club" ADD CONSTRAINT "trainer_club_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "training_groups" ADD CONSTRAINT "training_groups_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_club_memberships" ADD CONSTRAINT "user_club_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_club_memberships" ADD CONSTRAINT "user_club_memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_club_idx" ON "bookings" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_member_idx" ON "bookings" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_session_idx" ON "bookings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "club_members_club_user_idx" ON "club_members" USING btree ("club_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "club_members_user_idx" ON "club_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "name_idx" ON "clubs" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_schedule_idx" ON "sessions" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_trainer_idx" ON "sessions" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_court_idx" ON "sessions" USING btree ("court_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_week_idx" ON "sessions" USING btree ("week_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trainer_club_trainer_idx" ON "trainer_club" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trainer_club_club_idx" ON "trainer_club" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_club_memberships_user_club_idx" ON "user_club_memberships" USING btree ("user_id","club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_club_memberships_tenant_idx" ON "user_club_memberships" USING btree ("tenant_id");-- RLS Policies für Multi-Tenant Tennisclub Management
-- V1 MVP: Jeder Verein (Tenant) sieht nur seine eigenen Daten

-- Enable RLS on all tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_club_memberships ENABLE ROW LEVEL SECURITY;

-- POLICY: Clubs – nur Mitglieder des Vereins dürfen zugreifen
CREATE POLICY "club_member_access" ON clubs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = clubs.id
      AND user_id = auth.uid()
    )
  );

-- POLICY: Schedules – über Club-Zugehörigkeit
CREATE POLICY "schedule_access_via_club" ON schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clubs c
      JOIN user_club_memberships m ON m.club_id = c.id
      WHERE c.id = schedules.club_id
      AND m.user_id = auth.uid()
    )
  );

-- POLICY: Sessions – über Schedule-Club verknüpfen
CREATE POLICY "session_access_via_schedule" ON sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedules s
      JOIN clubs c ON s.club_id = c.id
      JOIN user_club_memberships m ON m.club_id = c.id
      WHERE s.id = sessions.schedule_id
      AND m.user_id = auth.uid()
    )
  );

-- POLICY: Bookings – Member sieht nur eigene Buchungen, Trainer/Admin sieht alle im Verein
CREATE POLICY "booking_access" ON bookings
  FOR ALL USING (
    member_id = auth.uid() -- eigene Buchungen
    OR
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = bookings.club_id
      AND user_id = auth.uid()
    )
  );

-- POLICY: Trainer – nur sichtbar für Mitglieder des eigenen Vereins
CREATE POLICY "trainer_club_access" ON trainers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trainer_club tc
      JOIN user_club_memberships m ON m.club_id = tc.club_id
      WHERE tc.trainer_id = trainers.id
      AND m.user_id = auth.uid()
    )
  );

-- POLICY: Courts – Club-Zugehörigkeit
CREATE POLICY "court_access" ON courts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = courts.club_id
      AND user_id = auth.uid()
    )
  );

-- POLICY: User Club Memberships – nur eigene Mitgliedschaften + Admin des Clubs
CREATE POLICY "club_membership_access" ON user_club_memberships
  FOR ALL USING (
    user_id = auth.uid() -- eigene Mitgliedschaft
    OR
    EXISTS (
      SELECT 1 FROM user_club_memberships m2
      WHERE m2.club_id = user_club_memberships.club_id
      AND m2.user_id = auth.uid()
      AND m2.role IN ('admin', 'superadmin')
    )
  );

-- POLICY: Trainer-Club Beziehungen – nur für Club-Admins sichtbar
CREATE POLICY "trainer_club_access_policy" ON trainer_club
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = trainer_club.club_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_user_id ON user_club_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_club_id ON user_club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_sessions_trainer_id ON sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member_id ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_id ON bookings(session_id);
