import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

let db: any;

if (process.env.NODE_ENV === 'test') {
  // Drizzle-like mock for tests with method chaining
  const createQuery = () => ({
    from: () => createQuery(),
    where: () => createQuery(),
    orderBy: () => createQuery(),
    limit: () => Promise.resolve([]),
    eq: () => ({}),
    inArray: () => ({}),
    asc: () => ({}),
    desc: () => ({}),
    // Terminal methods
    all: () => Promise.resolve([]),
    one: () => Promise.resolve({}),
    none: () => Promise.resolve({}),
  });

  db = {
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
} else if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
} else {
  const client = postgres(connectionString);
  db = drizzle(client, { schema });
}

export { db };
export type Database = typeof db;
