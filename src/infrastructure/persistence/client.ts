import type { drizzle } from 'drizzle-orm/postgres-js';

/**
 * Type definitions for the mock Drizzle DB used in test environments.
 * These are intentionally narrow — they model the subset of Drizzle's API
 * actually used by the SwingZ repositories. They are NOT a complete Drizzle
 * type definition.
 */

type EmptyRows = Promise<readonly never[]>;
const emptyRows: EmptyRows = Promise.resolve([]);

/** Chainable query-builder stub (returned by .from(), .where(), etc.) */
interface MockQueryBuilder<T = unknown> extends PromiseLike<readonly T[]> {
  from: () => MockQueryBuilder<T>;
  where: (...args: unknown[]) => MockQueryBuilder<T>;
  orderBy: (...args: unknown[]) => MockQueryBuilder<T>;
  limit: (n: number) => Promise<readonly T[]>;
  offset: (n: number) => MockQueryBuilder<T>;
  forUpdate: () => MockQueryBuilder<T>;
  forShare: () => MockQueryBuilder<T>;
  leftJoin: () => MockQueryBuilder<T>;
  rightJoin: () => MockQueryBuilder<T>;
  innerJoin: () => MockQueryBuilder<T>;
  fullJoin: () => MockQueryBuilder<T>;
  groupBy: (...args: unknown[]) => MockQueryBuilder<T>;
  having: (...args: unknown[]) => MockQueryBuilder<T>;
  all: () => Promise<readonly T[]>;
  one: () => Promise<T | null>;
  none: () => Promise<void>;
  returning: () => Promise<readonly T[]>;
  onConflictDoNothing: () => EmptyRows;
  onConflictDoUpdate: (...args: unknown[]) => MockQueryBuilder<T>;
}

/** Insert-builder stub: db.insert(table).values(...) */
interface MockInsertBuilder {
  values: (rows: unknown | readonly unknown[]) => MockQueryBuilder;
}

/** Update-builder stub: db.update(table).set(...).where(...) */
interface MockUpdateBuilder {
  set: (data: unknown) => {
    where: (...args: unknown[]) => MockQueryBuilder;
  };
}

/** Delete-builder stub: db.delete(table).where(...) */
interface MockDeleteBuilder {
  where: (...args: unknown[]) => MockQueryBuilder;
}

/** Transaction-callback db interface (same shape as the main db) */
export interface MockDb {
  select: (...args: unknown[]) => MockQueryBuilder;
  selectDistinct: (...args: unknown[]) => MockQueryBuilder;
  insert: (table: unknown) => MockInsertBuilder;
  update: (table: unknown) => MockUpdateBuilder;
  delete: (table: unknown) => MockDeleteBuilder;
  query: (...args: unknown[]) => EmptyRows;
  run: (...args: unknown[]) => EmptyRows;
  create: (...args: unknown[]) => EmptyRows;
  cast: (...args: unknown[]) => unknown;
  all: () => EmptyRows;
  one: () => Promise<Record<string, never>>;
  none: () => Promise<void>;
  execute: (...args: unknown[]) => Promise<Record<string, never>>;
  transaction: <R>(callback: (tx: MockDb) => Promise<R>) => Promise<R>;
}

/**
 * createMockDb()
 *
 * Returns a fully-mocked Drizzle instance that resolves to empty results.
 * Used in test environments where no real database is available.
 *
 * Supports: select, insert, update, delete, joins, groupBy, having,
 * conflict resolution, pagination, row locking, and transactions.
 *
 * NOTE: The return type is cast to `ReturnType<typeof drizzle>` because
 * Drizzle's full DB type is a complex generic union (PgDatabase / etc.)
 * that is not constructible as a literal. The `MockDb` interface above
 * is the authoritative type for *our* usage; the final cast exists only
 * so consumers can pass it where a real Drizzle DB is expected.
 */
export function createMockDb(): ReturnType<typeof drizzle> {
  const makeThenable = <T = unknown>(): MockQueryBuilder<T> => {
    const builder: MockQueryBuilder<T> = {
      from: () => createQuery<T>(),
      where: () => createQuery<T>(),
      orderBy: () => createQuery<T>(),
      limit: () => emptyRows as Promise<readonly T[]>,
      offset: () => createQuery<T>(),
      forUpdate: () => createQuery<T>(),
      forShare: () => createQuery<T>(),
      leftJoin: () => createQuery<T>(),
      rightJoin: () => createQuery<T>(),
      innerJoin: () => createQuery<T>(),
      fullJoin: () => createQuery<T>(),
      groupBy: () => createQuery<T>(),
      having: () => createQuery<T>(),
      all: () => emptyRows as Promise<readonly T[]>,
      one: () => Promise.resolve<T | null>(null),
      none: () => Promise.resolve(),
      returning: () => emptyRows as Promise<readonly T[]>,
      onConflictDoNothing: () => emptyRows,
      onConflictDoUpdate: () => createQuery<T>(),
      // Thenable contract for `await db.select()...` without terminal call
      then: (resolve) => Promise.resolve([] as T[]).then(resolve),
    };
    return builder;
  };

  const createQuery = <T = unknown>(): MockQueryBuilder<T> => makeThenable<T>();

  const buildDbMethods = (): MockDb => {
    const oneResult = Promise.resolve<Record<string, never>>({});
    return {
      select: () => createQuery(),
      selectDistinct: () => createQuery(),
      insert: () => ({
        values: () => createQuery(),
      }),
      update: () => ({
        set: () => ({
          where: () => createQuery(),
        }),
      }),
      delete: () => ({
        where: () => createQuery(),
      }),
      query: () => emptyRows,
      run: () => emptyRows,
      create: () => emptyRows,
      cast: () => ({}),
      all: () => emptyRows,
      one: () => oneResult,
      none: () => Promise.resolve(),
      execute: () => oneResult,
      // transaction is attached below so it can reference buildDbMethods
      transaction: ((callback: (tx: MockDb) => Promise<unknown>) =>
        callback(buildDbMethods())) as MockDb['transaction'],
    };
  };

  const dbMethods = buildDbMethods();

  // transaction(async (tx) => { ... })
  // tx has the same methods as db. If the callback resolves, the
  // transaction "commits" (empty mock). If it rejects, it "rolls back".
  const transaction = async <R>(callback: (tx: MockDb) => Promise<R>): Promise<R> => {
    return await callback(buildDbMethods());
  };

  return {
    ...dbMethods,
    transaction,
  } as unknown as ReturnType<typeof drizzle>;
}
