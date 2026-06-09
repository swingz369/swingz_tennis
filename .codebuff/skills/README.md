# SwingZ Codebuff Skills

This directory contains project-specific skills for the SwingZ codebase. Each skill provides immediate context about a specific subsystem — what files to look at, common patterns, gotchas, and how to extend the system.

## Available Skills

| Skill                                                                     | Purpose                                                                   | Triggers when...                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [**swingz-clustering-algorithm**](./swingz-clustering-algorithm/SKILL.md) | SeasonClusteringEngine — 5 phases, Sprint 3 optimizations, backtracking   | You mention: clustering, SeasonClusteringEngine, findBestTimeSlot, backtrack, conflict, saisonplanung |
| [**swingz-stripe-webhook**](./swingz-stripe-webhook/SKILL.md)             | Webhook handling, idempotency, event types, billing integration           | You mention: stripe, webhook, subscription, invoice, payment, billing, dunning                        |
| [**swingz-drizzle-rls**](./swingz-drizzle-rls/SKILL.md)                   | Drizzle schema, RLS policies, multi-tenant club_id scoping, migrations    | You mention: drizzle, schema, migration, rls, policy, club_id, table, column                          |
| [**swingz-conflict-detector**](./swingz-conflict-detector/SKILL.md)       | 8 conflict types, severity model, auto-resolve strategies                 | You mention: conflict, planning_conflicts, severity, auto-resolve, blocker                            |
| [**swingz-feature-flags**](./swingz-feature-flags/SKILL.md)               | Per-club JSONB feature config, immutability, gating patterns              | You mention: feature flag, features, hasFeature, isFeatureEnabled, module                             |
| [**swingz-booking-flow**](./swingz-booking-flow/SKILL.md)                 | Booking status machine, double-booking prevention, waitlist, cancellation | You mention: booking, Bookings, stornieren, Warteliste, court, session.capacity                       |
| [**swingz-rbac-permissions**](./swingz-rbac-permissions/SKILL.md)         | 4 roles, 30+ permissions, club-scoping, superadmin override               | You mention: rbac, role, permission, requireRole, requirePermission, admin, superadmin                |
| [**swingz-pdf-invoice**](./swingz-pdf-invoice/SKILL.md)                   | @react-pdf/renderer patterns, GoBD compliance, serverless caching         | You mention: pdf, invoice, react-pdf, Rechnung, GoBD, MwSt, pdf-lib                                   |

## How Skills Work

Codebuff skills are loaded **automatically at session start** when they match keywords in the user's request. Each skill is a single `SKILL.md` file with YAML frontmatter (`name`, `description`) followed by Markdown content.

The `description` field is the trigger — it should list all relevant keywords/synonyms. The Markdown body provides the actual knowledge.

## Adding a New Skill

1. Create `.codebuff/skills/<skill-name>/` directory
2. Create `SKILL.md` with frontmatter:
   ```markdown
   ---
   name: swingz-<subsystem>
   description: <1-2 sentences listing keywords that should trigger this skill>
   ---
   ```
3. Write the body in the same style as existing skills:
   - "Where it lives" — file paths
   - Architecture / critical patterns
   - Common tasks (with code snippets)
   - Gotchas
4. Add a row to the table above
5. Skills are loaded on next session start — no rebuild needed

## Skill Maintenance

Skills should be **kept in sync with code changes**. When you:

- Add a new file to a subsystem → update the "Where it lives" section
- Add a new pattern/convention → add a "Common tasks" entry
- Discover a gotcha → add it to the "Gotchas" section
- Remove a feature → mark as deprecated, don't delete immediately

If a skill gets out of date, regenerate it by re-running the file-picker on the subsystem and updating the relevant sections.
