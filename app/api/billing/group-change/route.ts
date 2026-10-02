import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api-auth';
import { internalErrorResponse } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
import { processGroupChange } from '@/lib/services/group-change.service';

const log = createLogger('api:billing:group-change');

const Schema = z.object({
  club_id: z.string().uuid(),
  season_id: z.string().uuid(),
  member_id: z.string().uuid(),
  old_group_id: z.string().uuid(),
  new_group_id: z.string().uuid(),
  change_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!auth.user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    const { supabase, user } = auth;

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', parsed.data.club_id)
      .eq('is_active', true)
      .maybeSingle();
    // Kein Trainer: Saisonplan (`season_plan_entries`) und Guthaben (`member_balances`) schreiben
    // laut RLS nur Admins. Ein Trainer-Aufruf hängte Buchungen um und scheiterte erst danach —
    // halber Wechsel ohne Plan- und Guthabenänderung.
    if (!membership || !['admin', 'superadmin'].includes(membership.role))
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });

    try {
      const result = await processGroupChange({ ...parsed.data, created_by: user.id });
      return NextResponse.json({ data: result });
    } catch (e) {
      log.error('Gruppenwechsel fehlgeschlagen', e instanceof Error ? e : undefined);
      return internalErrorResponse();
    }
  });
}
