import type { Config } from 'drizzle-kit';

const config: Config = {
  schema: './src/infrastructure/persistence/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};

export default config;
