/**
 * GET /api/admin/members/[id]/notes
 *   Gibt ALLE Trainer-Notizen für ein Mitglied zurück (Admin sieht alle).
 *
 * Hinweis: Früher unter `[memberId]/` (Slug-Konflikt mit `[id]/dsgvo-delete`
 * und `[id]/office-flags` ⇒ Next.js-Compile-Error `'id' !== 'memberId'`).
 * Param-Destructure aliasiert `id → memberId` (siehe `dsgvo-delete/route.ts`),
 * sodass DB-Queries, Response-Payloads und Log-Felder unverändert bleiben.
 *
 * SEMANTIK: Der Caller (`members-detail-client.tsx`) übergibt `member.user_id`
 * (auth.users.id), NICHT die membership-row.id — daher der lokale Variablenname
 * `userId` statt `memberId`. Schema-seitig filtert `trainer_member_notes.member_id`
 * auf den gleichen Wert.
 *
 * Auth: admin oder superadmin
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:members:notes');

// Slug ist `[id]` (Konflikt-Fix). Caller schickt `member.user_id` → lokaler Alias
// `userId` (nicht `memberId`) für ehrliche Semantik.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin-Zugang erforderlich');

    const { id: userId } = await params;
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId') ?? auth.clubId;

    if (!clubId) {
      return NextResponse.json({ error: 'clubId fehlt' }, { status: 400 });
    }

    // User-context client: trainer_member_notes RLS restricts admin to their own club.
    const { data: notes, error } = await auth.supabase
      .from('trainer_member_notes')
      .select('id, note, created_at, updated_at, trainers(id, name, email)')
      .eq('member_id', userId)
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
