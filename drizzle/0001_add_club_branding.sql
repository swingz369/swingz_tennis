-- Create club_branding table for white-label configuration
CREATE TABLE IF NOT EXISTS "club_branding" (
  "club_id" uuid PRIMARY KEY,
  "primary_color" varchar(7) NOT NULL DEFAULT '#1B4332',
  "secondary_color" varchar(7) NOT NULL DEFAULT '#1e3a5f',
  "accent_color" varchar(7) NOT NULL DEFAULT '#FF6B35',
  "logo_light_url" text,
  "logo_dark_url" text,
  "favicon_url" text,
  "custom_domain" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "club_branding" ADD CONSTRAINT "club_branding_club_id_clubs_id_fk"
  FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id")
  ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "club_branding_club_id_idx" ON "club_branding" USING btree ("club_id");