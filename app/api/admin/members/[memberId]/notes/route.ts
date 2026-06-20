/**
 * GET /api/admin/members/[memberId]/notes
 *   Gibt ALLE Trainer-Notizen für ein Mitglied zurück (Admin sieht alle).
 *
 * Auth: admin oder superadmin
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:members:notes');

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin-Zugang erforderlich');

    const { memberId } = await params;
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId') ?? auth.clubId;

    if (!clubId) {
      return NextResponse.json({ error: 'clubId fehlt' }, { status: 400 });
    }

    const service = createServiceClient();

    const { data: notes, error } = await (service as any)
      .from('trainer_member_notes')
      .select(
        `
        id,
        note,
        created_at,
        updated_at,
        trainers(id, name, email)
        `
      )
      .eq('member_id', memberId)
      .eq('club_id', clubId)
      .order('updated_at', { ascending: false });

    if (error) {
      log.error('Admin-Notizen-Abfrage fehlgeschlagen', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten trainer join
    const result = (notes ?? []).map((n: any) => {
      const trainer = Array.isArray(n.trainers) ? n.trainers[0] : n.trainers;
      return {
        id: n.id,
        note: n.note,
        created_at: n.created_at,
        updated_at: n.updated_at,
        trainer_id: trainer?.id ?? null,
        trainer_name: trainer?.name ?? null,
        trainer_email: trainer?.email ?? null,
      };
    });

    return NextResponse.json({ notes: result });
  });
}
