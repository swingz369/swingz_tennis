/**
 * PATCH /api/clubs/[id]/setup
 * Updates Supabase-only club fields used during the onboarding wizard.
 * Handles: name, city, address, phone, email, website, logo_url, description, founding_date,
 *          opening_hours, default_hourly_rate, default_session_duration_minutes,
 *          billing_unit_minutes, tax_rate, timezone, bundesland, setup_completed_at
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]:setup');

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Zugriff nur für Admins');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });

    // Only allow safe fields to be updated (onboarding wizard fields)
    const allowed = [
      'name',
      'city',
      'address',
      'phone',
      'email',
      'website',
      'setup_completed_at',
      'logo_url',
      'description',
      'founding_date',
      'opening_hours',
      'default_hourly_rate',
      'default_session_duration_minutes',
      'billing_unit_minutes',
      'tax_rate',
      'timezone',
      'bundesland',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Keine gültigen Felder zum Aktualisieren' },
        { status: 400 }
      );
    }

    // Convert empty strings for date/timestamp columns to null
    // (PostgreSQL rejects '' for date/timestamp types)
    for (const key of ['founding_date', 'setup_completed_at']) {
      if (updates[key] === '') updates[key] = null;
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await auth.supabase
      .from('clubs')
      .update(updates as any)
      .eq('id', id);

    if (error) {
      log.error('[Club Setup PATCH]', error);
      return internalErrorResponse();
    }

    // Sync club_city to system_settings so weather API can find it
    if (updates.city !== undefined) {
      const cityValue = updates.city ? String(updates.city) : null;
      if (cityValue) {
        const now = new Date().toISOString();
        const { data: existingSetting } = await auth.supabase
          .from('system_settings')
          .select('id')
          .eq('club_id', id)
          .eq('key', 'club_city')
          .limit(1);
        if (existingSetting && existingSetting.length > 0) {
          await auth.supabase
            .from('system_settings')
            .update({ value: cityValue, updated_at: now })
            .eq('id', existingSetting[0].id);
        } else {
          await auth.supabase.from('system_settings').insert({
            club_id: id,
            key: 'club_city',
            value: cityValue,
            category: 'general',
            type: 'string',
            updated_at: now,
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  });
}
