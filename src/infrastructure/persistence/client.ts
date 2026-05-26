import type { drizzle } from 'drizzle-orm/postgres-js';

/**
 * createMockDb()
 * Returns a fully-mocked Drizzle instance that returns empty results.
 * Used in test environments where no real database is available.
 * Supports all common Drizzle query patterns: select, insert, update,
 * delete, joins, groupBy, having, conflict resolution, pagination,
 * row locking, and transactions.
 */
export function createMockDb(): ReturnType<typeof drizzle> {
  // Shared empty-array promise for all mock queries
  const emptyArray = Promise.resolve([] as any[]);

  // Thenable: works with both `await` and chained `.returning()`
  const makeThenable = (): any => {
    const result: any = { returning: () => emptyArray };
    result.then = (resolve: any) => resolve([]);
    return result;
  };

  const createQuery = (): any => ({
    from: () => createQuery(),
    where: () => createQuery(),
    orderBy: () => createQuery(),
    limit: () => emptyArray,
    offset: () => createQuery(),
    forUpdate: () => createQuery(),
    leftJoin: () => createQuery(),
    rightJoin: () => createQuery(),
    innerJoin: () => createQuery(),
    fullJoin: () => createQuery(),
    groupBy: () => createQuery(),
    having: () => createQuery(),
    eq: () => ({}),
    inArray: () => ({}),
    asc: () => ({}),
    desc: () => ({}),
    all: () => emptyArray,
    one: () => Promise.resolve({}),
    none: () => Promise.resolve({}),
  });

  // Build a mock DB-like object (also used as the `tx` inside transactions)
  const buildDbMethods = (): any => ({
    select: () => createQuery(),
    selectDistinct: () => createQuery(),
    insert: () => ({
      values: () => ({
        returning: () => emptyArray,
        onConflictDoNothing: () => emptyArray,
        onConflictDoUpdate: () => makeThenable(),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => makeThenable(),
      }),
    }),
    delete: () => ({
      where: () => makeThenable(),
    }),
    query: () => emptyArray,
    run: () => emptyArray,
    create: () => emptyArray,
    cast: () => ({}),
    all: () => emptyArray,
    one: () => Promise.resolve({}),
    none: () => Promise.resolve({}),
    execute: () => Promise.resolve({}),
  });

  const dbMethods = buildDbMethods();

  // transaction(async (tx) => { ... })
  // tx has the same methods as db (select, insert, update, delete).
  // If the callback resolves, the transaction "commits" (empty mock).
  // If it rejects, the transaction "rolls back" (no side effects in mock).
  const transaction = async (callback: (tx: any) => Promise<any>): Promise<any> => {
    const tx = buildDbMethods();
    return await callback(tx);
  };

  return {
    ...dbMethods,
    transaction,
  } as any;
}
