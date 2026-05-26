import { drizzle } from 'drizzle-orm/postgres-js';

/**
 * createMockDb()
 * Returns a fully-mocked Drizzle instance that returns empty results.
 * Used in test environments where no real database is available.
 * Supports all common Drizzle query patterns: select, insert, update,
 * delete, joins, groupBy, having, and conflict resolution.
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

  return {
    select: () => createQuery(),
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
    transact: () => emptyArray,
    run: () => emptyArray,
    create: () => emptyArray,
    cast: () => ({}),
    all: () => emptyArray,
    one: () => Promise.resolve({}),
    none: () => Promise.resolve({}),
    execute: () => Promise.resolve({}),
  } as any;
}
