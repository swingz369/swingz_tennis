import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  const { id } = await params;
  const { data } = await createServiceClient()
    .from('clubs')
    .select('id, name, status')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 });
  return NextResponse.json({ club: data });
}
