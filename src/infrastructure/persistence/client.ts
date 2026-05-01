import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb(): ReturnType<typeof drizzle> {
  if (_db) return _db;

  if (process.env.NODE_ENV === 'test') {
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

    const mockDb = {
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
    };

    return mockDb as unknown as ReturnType<typeof drizzle>;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  _db = db;
  return db;
}
