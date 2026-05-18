/**
 * Environment Variable Validation with T3 Env
 * Pattern from INTEGRATION_ROADMAP.md Phase 1.5
 *
 * Validates environment variables at build time
 * Provides type-safe access to env vars
 * Prevents deployment with missing/invalid configuration
 */

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Server-side environment variables (never sent to client)
   * These are only accessible in server components and API routes
   */
  server: {
    // Supabase
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

    // Database (optional, for direct connections)
    DATABASE_URL: z.string().url().optional(),
    DIRECT_URL: z.string().url().optional(),

    // Rate Limiting (optional - falls back to in-memory)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

    // Observability (optional)
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    // Stripe (optional — app works without it)
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

    // Email (optional)
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().email().optional(),

    // AI (optional, future feature)
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),

    // OAuth (optional)
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // White-label & Integrations (optional)
    ZAPIER_WEBHOOK_URL: z.string().url().optional(),
    MAILCHIMP_WEBHOOK_URL: z.string().url().optional(),
    TWILIO_SMS_ENABLED: z.enum(['true', 'false']).optional(),
    CUSTOM_DOMAINS: z.string().optional(), // JSON string

    // SEPA creditor configuration
    SEPA_CREDITOR_NAME: z.string().min(1).optional(),
    SEPA_CREDITOR_IBAN: z.string().min(15).optional(),
    SEPA_CREDITOR_ID: z.string().min(1).optional(),
    SEPA_CREDITOR_BIC: z.string().min(8).optional(),
    SEPA_CREDITOR_STREET: z.string().optional(),
    SEPA_CREDITOR_CITY: z.string().optional(),
    SEPA_CREDITOR_POSTAL_CODE: z.string().optional(),
    SEPA_CREDITOR_COUNTRY: z.string().length(2).optional(),

    // Cron job security
    CRON_SECRET: z.string().min(16).optional(),
  },

  /**
   * Client-side environment variables (exposed to browser)
   * Must be prefixed with NEXT_PUBLIC_
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
    NEXT_PUBLIC_APP_URL: z
      .string()
      .url('Invalid app URL')
      .optional()
      .default('http://localhost:3000'),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    // Analytics — read by components/analytics-provider.tsx as NEXT_PUBLIC_GA_ID
    NEXT_PUBLIC_GA_ID: z.string().optional(),
    // A/B experiment overrides — comma-separated list of experiment:variant pairs
    // e.g. "landing_hero_cta:pricing_layout" (see lib/experiments.ts)
    NEXT_PUBLIC_EXPERIMENTS: z.string().optional(),
  },

  /**
   * Map environment variables to schema
   * This allows T3 Env to read the actual values from process.env
   */
  runtimeEnv: {
    // Server
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    ZAPIER_WEBHOOK_URL: process.env.ZAPIER_WEBHOOK_URL,
    MAILCHIMP_WEBHOOK_URL: process.env.MAILCHIMP_WEBHOOK_URL,
    TWILIO_SMS_ENABLED: process.env.TWILIO_SMS_ENABLED,
    CUSTOM_DOMAINS: process.env.CUSTOM_DOMAINS,
    SEPA_CREDITOR_NAME: process.env.SEPA_CREDITOR_NAME,
    SEPA_CREDITOR_IBAN: process.env.SEPA_CREDITOR_IBAN,
    SEPA_CREDITOR_ID: process.env.SEPA_CREDITOR_ID,
    SEPA_CREDITOR_BIC: process.env.SEPA_CREDITOR_BIC,
    SEPA_CREDITOR_STREET: process.env.SEPA_CREDITOR_STREET,
    SEPA_CREDITOR_CITY: process.env.SEPA_CREDITOR_CITY,
    SEPA_CREDITOR_POSTAL_CODE: process.env.SEPA_CREDITOR_POSTAL_CODE,
    SEPA_CREDITOR_COUNTRY: process.env.SEPA_CREDITOR_COUNTRY,
    CRON_SECRET: process.env.CRON_SECRET,

    // Client
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_EXPERIMENTS: process.env.NEXT_PUBLIC_EXPERIMENTS,
  },

  /**
   * Skip validation in test environment
   */
  skipValidation: process.env.NODE_ENV === 'test',

  /**
   * Treat empty strings as undefined
   * This allows optional env vars to be omitted completely
   */
  emptyStringAsUndefined: true,

  /**
   * Called when validation fails
   * Provides better error messages during build
   */
  onValidationError: (issues) => {
    console.error('❌ Invalid environment variables:');
    for (const issue of issues) {
      console.error(`  ${issue.path?.join('.') ?? '(root)'}: ${issue.message}`);
    }
    throw new Error('Invalid environment variables');
  },

  /**
   * Called when invalid client-side env vars are accessed on server
   */
  onInvalidAccess: (variable) => {
    throw new Error(
      `❌ Attempted to access client-side environment variable "${variable}" on the server`
    );
  },
});

/**
 * Usage example:
 *
 * ```ts
 * import { env } from '@/lib/env';
 *
 * // Type-safe, validated access
 * const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL; // ✅
 * const apiKey = env.SUPABASE_SERVICE_ROLE_KEY; // ✅ (server-only)
 *
 * // Unsafe access (will fail type check)
 * const unsafeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // ❌
 * ```
 */
