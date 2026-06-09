---
name: swingz-drizzle-migrations
description: SwingZ-specific knowledge for the Drizzle ORM schema and migration workflow — 2-schema split (auth + public), RLS-aware column types, idempotent migration patterns, JSONB columns (clubs.features, trainers.specialties, season_plan_entries.expected_participants), and the 80+ SQL migration files in supabase/migrations/.
---

# SwingZ Drizzle Migrations

## Where it lives

- **Schema (single source of truth):** `src/infrastructure/persistence/schema.ts` (~600 lines, all public.\* tables)
- **Season-planning schema (split out):** `src/infrastructure/persistence/season-planning-schema.ts` (seasons, season_plan_entries, season_planning_configs, season_statistics, season_waitlists, trainer_feedback, club_training_preferences)
- **DB connection:** `src/infrastructure/persistence/db.ts` (postgres.js via `getDatabaseUrl()` from `lib/env.ts`)
- **Migrations (raw SQL):** `supabase/migrations/20260610_club_features_jsonb.sql` and ~80 other timestamped files
- **Drizzle config:** `drizzle.config.ts` (schema path + out dir)
- **Generated types:** `supabase-types.ts` + `types/supabase.ts` (Supabase Auth API types)
- **Local dev container:** `swingz-test-db` (port 54323, image `postgres:15`)

## The 2-schema split (auth + public)

SwingZ uses **two separate schemas** intentionally — they map to the Supabase Auth boundary:

| Schema                        | Owner                  | Mutated via                                    | Why split                                    |
| ----------------------------- | ---------------------- | ---------------------------------------------- | -------------------------------------------- |
| `auth.users`                  | Supabase Auth (GoTrue) | `supabase.auth.admin.createUser()` (admin API) | bcrypt hashing needs GoTrue internals        |
| `public.users`                | Our Drizzle code       | `db.insert(users).values(...)`                 | app-level data: full_name, skill_level, etc. |
| `public.*` (all other tables) | Our Drizzle code       | `db.insert/update/delete`                      | clubs, courts, members, bookings, etc.       |

**Critical rule:** `auth.users` is **NEVER** written via Drizzle. Use `supabase.auth.admin.createUser()` (Service-Role-Key) for new users — the seed-perf-test-supabase.ts script is the reference implementation.

## Multi-tenancy: the `club_id` pattern

Almost every public table has a `club_id uuid NOT NULL REFERENCES clubs(id)`. The pattern is enforced by:

- RLS policies (`create policy ... using (club_id = current_setting('app.current_club_id')::uuid)`)
- Explicit `where(eq(table.clubId, session.clubId))` in every query (RLS is a safety net, not a replacement)

Tables with `club_id`: clubs (self-ref via id), courts, members, trainers, groups, sessions, bookings, invoices, user_club_memberships, trainer_club, season_plan_entries, season_planning_configs, season_statistics, etc.

## JSONB columns (3 common patterns)

```typescript
// 1. Static shape — typed via $inferInsert
opening_hours: jsonb('opening_hours').$type<{
  monday: { open: string; close: string };
  tuesday: { open: string; close: string };
  // ...
}>().notNull(),

// 2. Record-of-anything (feature flags)
features: jsonb('features').$type<Record<FeatureName, boolean>>()
  .notNull().default({}),

// 3. String array stored as JSONB (no native string[] in older Postgres-Drizzle setups)
wish_partner_ids: jsonb('wish_partner_ids').$type<string[]>()
  .notNull().default([]),
```

GIN-index JSONB for fast lookups: `CREATE INDEX idx_clubs_features_gin ON clubs USING GIN (features jsonb_path_ops);`

## Migration workflow

### Adding a new column (3-step pattern)

1. **Create SQL migration** in `supabase/migrations/20260610_club_features_jsonb.sql` (use the `YYYYMMDD_<name>.sql` naming pattern):

   ```sql
   ALTER TABLE clubs
     ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

   CREATE INDEX IF NOT EXISTS idx_clubs_features_gin
     ON clubs USING GIN (features jsonb_path_ops);

   COMMENT ON COLUMN clubs.features IS
     'Per-club feature flag map (JSONB). Core features (members, trainers) are immutable.';
   ```

2. **Update Drizzle schema** in `schema.ts` (or `season-planning-schema.ts`):

   ```typescript
   export const clubs = pgTable('clubs', {
     // ...existing columns...
     features: jsonb('features').$type<ClubFeatures>().notNull().default({}),
   });
   ```

3. **Apply locally**:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/YYYYMMDD_<name>.sql
   # OR via tsx:
   npx tsx -e "import {Pool} from 'pg'; import {readFileSync} from 'fs'; const p=new Pool({connectionString:process.env.DATABASE_URL}); await p.query(readFileSync('supabase/migrations/...','utf-8')); await p.end();"
   ```

### Idempotent migrations (`.sql` pattern)

Always use `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TABLE IF EXISTS` so migrations can be re-run safely. The `IF NOT EXISTS` style is used throughout the 81+ existing migrations.

### Migration naming

`YYYYMMDD_<short_snake_case_description>.sql` — sort-friendly, human-readable. Examples:

- `20260610_club_features_jsonb.sql` (adds `clubs.features` JSONB column + GIN index)
- `20260629_season_planning_config_optimizations.sql` (Sprint 3 config columns)

## Common gotchas

- **`*.sql` in .gitignore** (project default). The new whitelist `!supabase/migrations/*.sql` keeps your migrations tracked. Use `git add supabase/migrations/...` (no `-f` needed).
- **postgres.js config** (Vercel serverless): `src/lib/env.ts:getDatabaseUrl()` sets `prepare: false` — Drizzle's prepared-statement cache is disabled. Migrations still work.
- **Drizzle $inferInsert strictness**: when you build a payload dynamically, the strict overloads of `.values()` reject `Partial<T>`. Use the `as unknown as (typeof table.$inferInsert)[]` bridge (see `saveToDatabase()` in clustering-engine.ts).
- **Mixed identifier styles**: Drizzle fields use snake_case in SQL (`club_id`), camelCase in TS (`clubId`). Drizzle's `text('club_id')` or `uuid('club_id')` does the mapping automatically — never manually `.snake_case()` it.
- **Server-side `cookies()` trap**: `src/infrastructure/external/supabase/server.ts` uses `next/headers cookies()` — only works in Next.js context, NOT in plain Node scripts. For seed scripts, use `createClient` from `@supabase/supabase-js` directly.
- **DB URL helper lives in `lib/env.ts`** (not `src/lib/env.ts`) — when the env-helper path is referenced from migration scripts, import from `lib/env` (no `src/` prefix).
- **Drizzle migrations vs raw SQL**: project uses RAW SQL migrations (in `supabase/migrations/`) for production changes, NOT `drizzle-kit generate`. The Drizzle schema file is the source of truth for type-safety, but migration files are hand-written SQL.

## Adding a new table (checklist)

1. Add to appropriate schema file (`schema.ts` or `season-planning-schema.ts`)
2. Add `club_id uuid NOT NULL REFERENCES clubs(id)` if multi-tenant
3. Add RLS policy in a new SQL migration (one policy per CRUD operation)
4. Add a repository in `src/infrastructure/persistence/repositories/`
5. Add a use-case in `src/application/<domain>/`
6. Add a service in `src/application/services/` if business logic is non-trivial
7. Add API routes in `app/api/<domain>/`
8. Add to the swingz-drizzle-rls skill's "Where it lives" table

## Related skills

- `swingz-drizzle-rls` — RLS policies, multi-tenant scoping, migrations workflow
- `swingz-feature-flags` — uses the `clubs.features` JSONB column
- `swingz-rbac-permissions` — 4-role hierarchy that controls `club_id` access
