import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
const log = createLogger('cron:refresh-base-rates');

/**
 * GET /api/cron/refresh-base-rates[?valid_from=YYYY-MM-DD&rate=0.025&source=...]
 *
 * Vercel Cronjobs rufen typischerweise GET auf (siehe vercel.json "crons").
 * Diese Route ist idempotent und bewusst GET-only (kein CSRF-Wrap nötig):
 *  • Ohne Query-Params: Diagnose-Modus — prüft, ob ein Refresh fällig ist
 *    (1. Jan / 1. Jul) und liefert die letzten N bekannten Sätze zurück.
 *  • Mit Query-Params (?valid_from&rate&source): Upsert in base_interest_rates
 *    (ON CONFLICT DO NOTHING → idempotent).
 *
 * Auth: Header `x-cron-secret` muss env.CRON_SECRET matchen ODER
 * Header `Authorization: Bearer <CRON_SECRET>` (Vercel Cron-Konvention).
 * Vergleich erfolgt timing-safe (crypto.timingSafeEqual), um theoretische
 * Timing-Angriffe auf den Vergleich zu verhindern.
 *
 * Hinweis: Bundesbank hat keine offizielle REST-API für Basiszinssatz. Diese
 * Route nimmt den neuen Satz als Parameter entgegen und erwartet, dass ein
 * Ops-Job den Wert manuell aus der Bundesbank-PDF übernimmt. Fast-Path
 * Aufruf:
 *
 *   curl -H "x-cron-secret: $CRON_SECRET" \
 *        "https://swingz.vercel.app/api/cron/refresh-base-rates?\
 *         valid_from=2026-07-01&rate=0.0153&source=Bundesbank+H2/2026"
 *
 * Langfristig: GitHub Action / eigener Scheduler ruft diese URL halbjährlich.
 */
export async function GET(request: NextRequest) {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const headerSecret =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!headerSecret || !safeEqualStrings(headerSecret, cronSecret)) {
    log.warn('Unauthorized refresh-base-rates call');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createServiceClient();
  const { searchParams } = new URL(request.url);

  const validFrom = searchParams.get('valid_from');
  const rateRaw = searchParams.get('rate');
  const source = searchParams.get('source') ?? 'Bundesbank (manual)';

  // Diagnose-Modus (kein Query → nur Report)
  if (!validFrom || !rateRaw) {
    return await runDiagnostics(sb);
  }

  // Upsert-Modus
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.2) {
    return NextResponse.json(
      {
        error: 'rate außerhalb des plausiblen Bereichs (0–20%)',
        hint: 'Zinssatz als Dezimalbruch übergeben, z.B. 0.0227 für 2,27%',
      },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
    return NextResponse.json(
      { error: 'valid_from muss im Format YYYY-MM-DD sein' },
      { status: 400 }
    );
  }

  const { error } = await sb.from('base_interest_rates').upsert(
    {
      valid_from: validFrom,
      rate,
      source,
    },
    { onConflict: 'valid_from' }
  );

  if (error) {
    log.error('Failed to upsert base_interest_rates', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.info('Base interest rate upserted', { validFrom, rate, source });

  return NextResponse.json({
    ok: true,
    upserted: { valid_from: validFrom, rate, source },
  });
}

async function runDiagnostics(sb: ReturnType<typeof createServiceClient>) {
  const { data, error } = await sb
    .from('base_interest_rates')
    .select('valid_from, rate, source, created_at')
    .order('valid_from', { ascending: false })
    .limit(10);

  if (error) {
    log.error('Diagnostics failed', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lastValidFrom = data?.[0]?.valid_from ?? null;
  const nextRefresh = computeNextRefreshDate(new Date());

  // Refresh fällig genau am 1.1. oder 1.7. → ja wenn lastValidFrom älter
  const today = new Date().toISOString().slice(0, 10);
  const isRefreshDue = lastValidFrom === null || (lastValidFrom <= today && nextRefresh <= today);

  return NextResponse.json({
    ok: true,
    isRefreshDue,
    lastValidFrom,
    nextRefresh,
    recentRates: data ?? [],
    hint: isRefreshDue
      ? 'Refresh fällig. Neuen Satz per GET-Query-Param upserten (siehe Curl-Beispiel im Datei-Header).'
      : 'Kein Refresh nötig.',
  });
}

/**
 * Berechnet das nächste 1.1./1.7.-Datum rein aus heutigem Datum.
 * (lastValidFrom bewusst nicht berücksichtigt — Funktion ist date-pure.)
 */
function computeNextRefreshDate(today: Date): string {
  const yyyy = today.getUTCFullYear();
  const candidates = [`${yyyy}-01-01`, `${yyyy}-07-01`, `${yyyy + 1}-01-01`];
  const todayStr = today.toISOString().slice(0, 10);
  for (const c of candidates) {
    if (c > todayStr) return c;
  }
  return candidates[candidates.length - 1]!;
}

/**
 * Konstant-Zeit-Vergleich zweier Strings, um Timing-Angriffe zu verhindern.
 * Beide Buffer werden auf eine gemeinsame Feste Länge gepaddet, damit weder
 * Längen-Differenz noch Zeichen-Differenz per Reaktionszeit ableitbar sind.
 */
const SAFE_COMPARE_LEN = 256;
function safeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.alloc(SAFE_COMPARE_LEN);
  const bBuf = Buffer.alloc(SAFE_COMPARE_LEN);
  Buffer.from(a).copy(aBuf);
  Buffer.from(b).copy(bBuf);
  // Erst nach padding vergleichen — keine Längen-Leaks.
  return timingSafeEqual(aBuf, bBuf);
}
