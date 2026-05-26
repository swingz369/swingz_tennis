import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

function createMockDb(): ReturnType<typeof drizzle> {
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

export function getDb(): ReturnType<typeof drizzle> {
  if (_db) return _db;

  // Return mock in test environment or when DATABASE_URL is not available (e.g., during build)
  if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
      console.error('[getDb] DATABASE_URL not set — using mock DB. All queries will return empty results.');
    }
    return createMockDb();
  }

  try {
    const client = postgres(process.env.DATABASE_URL);
    const db = drizzle(client, { schema });
    _db = db;
    return db;
  } catch (error) {
    console.error('Failed to initialize database, falling back to mock:', error);
    return createMockDb();
  }
}
