CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"level" varchar(20) DEFAULT 'intermediate' NOT NULL,
	"age_group" varchar(20) DEFAULT 'senior' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"court_id" uuid,
	"rule_type" varchar(50) DEFAULT 'hourly' NOT NULL,
	"min_booking_hours" numeric(5, 2) DEFAULT '1',
	"max_booking_hours" numeric(5, 2) DEFAULT '4',
	"price_per_hour" numeric(10, 2) NOT NULL,
	"advance_booking_days" integer DEFAULT 7,
	"applies_to_member_types" jsonb DEFAULT '[]'::jsonb,
	"applies_to_groups" jsonb DEFAULT '[]'::jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_club_memberships" DROP CONSTRAINT "user_club_memberships_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "session_start_time" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "club_members" ADD COLUMN "role" varchar(50) DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "default_hourly_rate" numeric(10, 2) DEFAULT '15.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_id","resource_type");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "groups_club_idx" ON "groups" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "groups_club_name_idx" ON "groups" USING btree ("club_id","name");--> statement-breakpoint
CREATE INDEX "pricing_rules_club_idx" ON "pricing_rules" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "pricing_rules_court_idx" ON "pricing_rules" USING btree ("court_id");--> statement-breakpoint
CREATE INDEX "pricing_rules_club_priority_idx" ON "pricing_rules" USING btree ("club_id","priority");--> statement-breakpoint
CREATE INDEX "club_members_role_idx" ON "club_members" USING btree ("role");