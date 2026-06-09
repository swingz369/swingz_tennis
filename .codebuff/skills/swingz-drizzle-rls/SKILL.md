---
name: swingz-drizzle-rls
description: SwingZ-specific knowledge for the Drizzle ORM schema, RLS policies, multi-tenant club_id scoping, and the migration workflow.
---

# SwingZ Drizzle + RLS

## Where it lives

- **Main schema:** `src/infrastructure/persistence/schema.ts` (users, clubs, courts, bookings, etc.)
- **Season-planning schema:** `src/infrastructure/persistence/season-planning-schema.ts` (seasonPlanEntries, seasonWaitlists, seasonPlanningConfigs, trainerFeedback, seasonStatistics)
- **DB client:** `src/infrastructure/persistence/client.ts` (postgres.js + drizzle, SSL configured for Vercel)
- **Config:** `drizzle.config.ts` (schema path, output `./drizzle`, dialect `postgresql`)
- **Migrations folder:** `drizzle/` (auto-generated), `supabase/migrations/` (manual SQL)
- **Journal:** `drizzle/meta/_journal.json` (version 7, 12 entries: 0000–0011)

## The schema is split into 2 files (intentional)

- `schema.ts` — Core business tables (clubs, courts, members, bookings, invoices, etc.)
- `season-planning-schema.ts` — Sprint 2.5+ season planning tables (separate concern, own iteration)

If you're adding a new table that relates to season planning, add it to `season-planning-schema.ts`. Otherwise to `schema.ts`.

## Multi-tenant scoping (CRITICAL)

**Every** business table must have a `club_id` column and an RLS policy. The pattern:

```typescript
// In schema.ts
export const myTable = pgTable('my_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  club_id: uuid('club_id').notNull().references(() => clubs.id),
  // ... other columns
});

// In drizzle migration or supabase migration:
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own club's data" ON my_table
  FOR SELECT USING (club_id = (auth.jwt() ->> 'club_id')::uuid);
```

**Never** write a query without a `WHERE club_id = $1` clause. The RLS is a safety net, not a replacement for explicit scoping.

## RLS policies we have (check before adding a new table)

| Table                     | Policy name                    | Level     |
| ------------------------- | ------------------------------ | --------- |
| `users`                   | `Users can see own profile`    | user      |
| `clubs`                   | `Club members see own club`    | club      |
| `courts`                  | `Club-scoped court visibility` | club      |
| `bookings`                | `Members see own bookings`     | user+club |
| `invoices`                | `Club admins see own invoices` | club      |
| `season_plan_entries`     | `Club members see own plan`    | club      |
| `trainer_feedback`        | `Trainers see own feedback`    | user+club |
| `season_planning_configs` | `Club admins only`             | club+role |

If your new table needs a policy that doesn't exist above, add it to the same migration as the table.

## Migration workflow

### For schema changes via Drizzle

```bash
# 1. Edit schema.ts (or season-planning-schema.ts)
# 2. Generate migration
npx drizzle-kit generate

# 3. Review drizzle/000X_*.sql — NEVER blindly apply
# 4. Apply locally
DATABASE_URL=postgresql://... npx drizzle-kit migrate
# 5. Test
npm run test:integration
# 6. Commit schema.ts + drizzle/000X_*.sql together
```

### For SQL-only changes (RLS, triggers, custom functions)

Create `supabase/migrations/YYYYMMDD_description.sql`:

```sql
-- supabase/migrations/20260629_add_rls_to_my_table.sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON my_table FOR SELECT USING (...);
```

These run AFTER drizzle migrations in the `postbuild` script.

## Common column patterns

| Pattern     | Example                                                                 | Notes                              |
| ----------- | ----------------------------------------------------------------------- | ---------------------------------- |
| ID          | `id: uuid('id').primaryKey().defaultRandom()`                           | ALWAYS uuid, never serial          |
| FK          | `club_id: uuid('club_id').notNull().references(() => clubs.id)`         | `.notNull()` unless truly optional |
| Timestamp   | `created_at: timestamp('created_at').notNull().defaultNow()`            | Both `created_at` AND `updated_at` |
| Soft delete | `deleted_at: timestamp('deleted_at')`                                   | Nullable, query with `IS NULL`     |
| Status      | `status: varchar('status', { length: 20 }).notNull().default('active')` | Enum via varchar + check           |
| JSON        | `features: jsonb('features').notNull().default({})`                     | Default to empty object, not null  |
| Money       | `amount: numeric('amount', { precision: 10, scale: 2 }).notNull()`      | NEVER use float for money          |

## Type exports

Always export the inferred types:

```typescript
export type MyTable = typeof myTable.$inferSelect;
export type NewMyTable = typeof myTable.$inferInsert;
```

And add them to `lib/season-planning/types.ts` (for season-planning) or to a similar `lib/<domain>/types.ts` file.

## Common tasks

### Add a new column to existing table

1. Edit the `pgTable` definition
2. `npx drizzle-kit generate` — review the generated SQL
3. For non-nullable: add `.default(...)` to avoid breaking existing rows
4. Apply migration + test

### Add a new table

1. Create in `schema.ts` (or appropriate schema file)
2. Add RLS policy in same migration
3. Add type exports
4. Add repository in `src/infrastructure/persistence/repositories/`
5. Add seed data to `scripts/seed-test-club-rheinland.ts` (if test club needed)

### Debug a "permission denied" error

1. Check if RLS is enabled: `SELECT relname, relrowsecurity FROM pg_class WHERE relname='my_table';`
2. Check policies: `SELECT * FROM pg_policies WHERE tablename='my_table';`
3. Check JWT: `SELECT auth.jwt();` — does it have `club_id` claim?
4. Test with `SET LOCAL role authenticated; SET LOCAL "request.jwt.claims" = '{"club_id": "...", "sub": "..."}';`

## Gotchas

- **postgres.js on Vercel:** The `client.ts` uses `prepare: false` for serverless compatibility. **Never** change this without testing on Vercel.
- **SSL on localhost:** `drizzle.config.ts` disables SSL for localhost. Don't deploy to Vercel with `localhost` in `DATABASE_URL`.
- **Migration order:** `drizzle-kit migrate` runs Drizzle migrations, then `postbuild` runs `supabase/migrations/`. Both must be in sequence.
- **No `any` types in repositories:** Use `db.select().from(table).where(eq(table.club_id, clubId))` — fully typed all the way down.
- **Schema files in tsconfig:** Both `src/infrastructure/persistence/schema.ts` and `season-planning-schema.ts` must be in tsconfig `include` — check if adding a new schema file.
