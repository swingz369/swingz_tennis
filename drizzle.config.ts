import type { Config } from 'drizzle-kit';

const config: Config = {
  schema: './src/infrastructure/persistence/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  },
};

export default config;
