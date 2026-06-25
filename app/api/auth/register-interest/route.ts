import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

const log = createLogger('api:auth:register-interest');

export async function POST(req: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STRICT);
  if (rateLimitError) return rateLimitError;

  const body = await req.json().catch(() => ({}));
  const { name, clubName, email, message } = body;

  if (!name || !email) {
    return NextResponse.json({ error: 'Name und E-Mail sind erforderlich' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Tabelle club_access_requests (Migration 20260622_club_access_requests.sql)
  const { error } = await sb.from('club_access_requests').insert({
    name,
    club_name: clubName || null,
    email,
    message: message || null,
    status: 'pending',
  });

  if (error) {
    log.error('Could not store access request', error);
  }

  log.info('Access request received', { email, clubName });
  return NextResponse.json({ success: true });
}
