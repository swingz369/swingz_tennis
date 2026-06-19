import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:health');

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let supabaseOk = false;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('clubs').select('id').limit(1);
    supabaseOk = !error;
    if (error) log.error('Health supabase check failed', error);
  } catch (e) {
    log.error('Health check threw', e instanceof Error ? e : undefined);
  }

  const status = supabaseOk ? 'ok' : 'error';
  const body = {
    status,
    timestamp: new Date().toISOString(),
    checks: { supabase: supabaseOk ? 'ok' : 'error' },
    responseTime: `${Date.now() - start}ms`,
  };

  return NextResponse.json(body, {
    status: supabaseOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
