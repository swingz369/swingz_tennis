/**
 * Type-safe helper for Drizzle partial updates
 * Replaces the `any` pattern used across repositories.
 *
 * Usage:
 *   const updateData: PartialUpdate<typeof feeConfigurations> = { ... };
 *   await db.update(feeConfigurations).set(updateData).where(...)
 */

import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Make all columns optional in a Drizzle table type
 */
export type PartialUpdate<T extends PgTable> = {
  [K in keyof T['$inferInsert']]?: T['$inferInsert'][K];
};
