ALTER TABLE "clubs" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "founding_date" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "superadmin_setup_completed_at" timestamp;