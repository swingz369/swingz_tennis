import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { UpdateCateringSchema } from '@/lib/types/catering';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:leagues:[id]:caterings:[cateringId]');

/**
 * PATCH /api/leagues/[id]/caterings/[cateringId] — Status / Notizen aktualisieren
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cateringId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin-Zugriff erforderlich');

    const { cateringId } = await params;
    const body = await request.json();
    const parsed = UpdateCateringSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });
    }

    const sb = createServiceClient();
    const { data, error } = await (sb as any)
      .from('match_caterings')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', cateringId)
      .eq('club_id', auth.clubId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update catering', error);
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Bewirtung' },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ error: 'Bewirtungseintrag nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ catering: data });
  });
}
