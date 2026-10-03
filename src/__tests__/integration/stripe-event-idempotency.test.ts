/**
 * check_and_record_stripe_event ist der Duplikatschutz des Stripe-Webhooks. Die Funktion
 * brach bis 03.10.2026 bei jedem Aufruf ab (boolean > integer) — jeder Webhook in
 * Produktion scheiterte, ohne dass ein Test es bemerkte.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL || '';
const describeDb = DB_URL && /localhost|127\.0\.0\.1/.test(DB_URL) ? describe : describe.skip;

describeDb('check_and_record_stripe_event', () => {
  let sql: ReturnType<typeof postgres>;
  const eventId = `evt_test_idempotenz_${Date.now()}`;

  beforeAll(() => {
    sql = postgres(DB_URL, { max: 1 });
  });
  afterAll(async () => {
    await sql`DELETE FROM stripe_events WHERE stripe_event_id = ${eventId}`;
    await sql.end();
  });

  it('meldet ein neues Ereignis als neu und eine Wiederholung als bekannt', async () => {
    const [first] =
      await sql`SELECT public.check_and_record_stripe_event(${eventId}, 'test') AS fresh`;
    const [second] =
      await sql`SELECT public.check_and_record_stripe_event(${eventId}, 'test') AS fresh`;
    expect(first.fresh).toBe(true);
    expect(second.fresh).toBe(false);
  });
});
