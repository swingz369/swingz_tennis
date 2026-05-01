import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

function createMockDb(): ReturnType<typeof drizzle> {
  const createQuery = () => ({
    from: () => createQuery(),
    where: () => createQuery(),
    orderBy: () => createQuery(),
    limit: () => Promise.resolve([]),
    eq: () => ({}),
    inArray: () => ({}),
    asc: () => ({}),
    desc: () => ({}),
    all: () => Promise.resolve([]),
    one: () => Promise.resolve({}),
    none: () => Promise.resolve({}),
  });

  return {
    select: () => createQuery(),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve([]),
    }),
    query: () => Promise.resolve([]),
    transact: () => Promise.resolve([]),
    run: () => Promise.resolve([]),
    create: () => Promise.resolve([]),
    cast: () => ({}),
    all: () => Promise.resolve([]),
    one: () => Promise.resolve({}),
    none: () => Promise.resolve({}),
    execute: () => Promise.resolve({}),
  } as any;
}

export function getDb(): ReturnType<typeof drizzle> {
  if (_db) return _db;

  // Return mock in test environment or when DATABASE_URL is not available (e.g., during build)
  if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
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
