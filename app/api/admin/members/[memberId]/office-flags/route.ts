/**
 * PATCH /api/admin/members/[memberId]/office-flags
 * GET  /api/admin/members/[memberId]/office-flags
 *
 * F4.4 — Ämterflag-Verwaltung (A2)
 * Setzt / liest office_flags JSONB auf user_club_memberships.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:members:office-flags');

const VALID_OFFICES = [
  'kassenwart',
  'jugendwart',
  'platzwart',
  'mannschaftsfuehrer',
  'turnierleiter',
] as const;

const PatchSchema = z.object({
  office: z.enum(VALID_OFFICES),
  active: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin-Zugriff erforderlich');
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    const { memberId } = await params;
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });

    const { office, active } = parsed.data;
    const sb = createServiceClient();

    const { data: mem, error: fetchErr } = await sb
      .from('user_club_memberships')
      .select('id, office_flags')
      .eq('user_id', memberId)
      .eq('club_id', auth.clubId)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchErr || !mem) {
      return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
    }

    const current = (mem.office_flags as Record<string, boolean> | null) ?? {};
    const updated = { ...current, [office]: active };

    const { error: updateErr } = await sb
      .from('user_club_memberships')
      .update({ office_flags: updated })
      .eq('id', mem.id);

    if (updateErr) {
      log.error('office-flags update failed', updateErr);
      return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 500 });
    }

    return NextResponse.json({ office_flags: updated });
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin-Zugriff erforderlich');
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    const { memberId } = await params;
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('user_club_memberships')
      .select('office_flags')
      .eq('user_id', memberId)
      .eq('club_id', auth.clubId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ office_flags: data.office_flags ?? {} });
  });
}
