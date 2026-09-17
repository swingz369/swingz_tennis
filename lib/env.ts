/**
 * lib/env.ts — Type-Safe Environment Variables
 *
 * Uses @t3-oss/env-nextjs + Zod for runtime validation.
 * Inspired by TSOWAPP's env.ts pattern.
 *
 * Benefits:
 * - Type-safe env vars with autocomplete
 * - Missing vars caught at build time (not in production)
 * - Documentation of all required variables in one place
 * - skipValidation for tests
 */

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    STRIPE_PRICE_SOLO_S: z.string().optional(),
    STRIPE_PRICE_SOLO_S_6M: z.string().optional(),
    STRIPE_PRICE_SOLO_S_Y: z.string().optional(),
    STRIPE_PRICE_SOLO_L: z.string().optional(),
    STRIPE_PRICE_SOLO_L_6M: z.string().optional(),
    STRIPE_PRICE_SOLO_L_Y: z.string().optional(),
    STRIPE_PRICE_SCHOOL_S: z.string().optional(),
    STRIPE_PRICE_SCHOOL_S_6M: z.string().optional(),
    STRIPE_PRICE_SCHOOL_S_Y: z.string().optional(),
    STRIPE_PRICE_SCHOOL_L: z.string().optional(),
    STRIPE_PRICE_SCHOOL_L_6M: z.string().optional(),
    STRIPE_PRICE_SCHOOL_L_Y: z.string().optional(),
    STRIPE_STARTER_PRICE_ID: z.string().optional(), // legacy
    STRIPE_PROFESSIONAL_PRICE_ID: z.string().optional(), // legacy
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    CRON_SECRET: z.string().min(1),
    /**
     * Bezahlschranke abschalten — NUR bis zum offiziellen Launch.
     *
     * `off` lässt jeden Verein alles nutzen, ohne Abo. Alles andere (auch
     * nicht gesetzt) heisst: Schranke ist scharf. Die Richtung ist Absicht —
     * wer die Variable beim Launch vergisst, bekommt die Schranke zurück,
     * nicht still verschenkte Umsätze.
     *
     * Wiedereinschalten: Variable entfernen (lokal und bei Vercel).
     * Siehe docs/OPEN_ITEMS.md § Vor dem Launch.
     */
    SUBSCRIPTION_ENFORCEMENT: z.enum(['on', 'off']).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  },
  runtimeEnv: {
    // Server
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_SOLO_S: process.env.STRIPE_PRICE_SOLO_S,
    STRIPE_PRICE_SOLO_S_6M: process.env.STRIPE_PRICE_SOLO_S_6M,
    STRIPE_PRICE_SOLO_S_Y: process.env.STRIPE_PRICE_SOLO_S_Y,
    STRIPE_PRICE_SOLO_L: process.env.STRIPE_PRICE_SOLO_L,
    STRIPE_PRICE_SOLO_L_6M: process.env.STRIPE_PRICE_SOLO_L_6M,
    STRIPE_PRICE_SOLO_L_Y: process.env.STRIPE_PRICE_SOLO_L_Y,
    STRIPE_PRICE_SCHOOL_S: process.env.STRIPE_PRICE_SCHOOL_S,
    STRIPE_PRICE_SCHOOL_S_6M: process.env.STRIPE_PRICE_SCHOOL_S_6M,
    STRIPE_PRICE_SCHOOL_S_Y: process.env.STRIPE_PRICE_SCHOOL_S_Y,
    STRIPE_PRICE_SCHOOL_L: process.env.STRIPE_PRICE_SCHOOL_L,
    STRIPE_PRICE_SCHOOL_L_6M: process.env.STRIPE_PRICE_SCHOOL_L_6M,
    STRIPE_PRICE_SCHOOL_L_Y: process.env.STRIPE_PRICE_SCHOOL_L_Y,
    STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID,
    STRIPE_PROFESSIONAL_PRICE_ID: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    SUBSCRIPTION_ENFORCEMENT: process.env.SUBSCRIPTION_ENFORCEMENT,
    // Client
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.NODE_ENV === 'test',
});
