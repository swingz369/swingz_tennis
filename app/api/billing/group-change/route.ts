import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';
import { internalErrorResponse } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
import { processGroupChange } from '@/lib/services/group-change.service';

const log = createLogger('api:billing:group-change');

const Schema = z.object({
  club_id: z.string().uuid(),
  member_id: z.string().uuid(),
  old_group_id: z.string().uuid(),
  new_group_id: z.string().uuid(),
  change_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, user } = auth;

  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: membership } = await (supabase as any)
    .from('user_club_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('club_id', parsed.data.club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!membership || !['admin', 'superadmin', 'trainer'].includes(membership.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await processGroupChange({ ...parsed.data, created_by: user.id });
    return NextResponse.json({ data: result });
  } catch (e) {
    log.error('Gruppenwechsel fehlgeschlagen', e instanceof Error ? e : undefined);
    return internalErrorResponse();
  }
}
