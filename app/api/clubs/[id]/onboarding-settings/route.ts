/**
 * POST /api/clubs/[id]/onboarding-settings
 * Upserts system_settings rows for language and email config during onboarding.
 * Only accessible by admin/superadmin.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

const ALLOWED_KEYS = ['language', 'email_from_name', 'email_from_address'] as const;

const CATEGORY_MAP: Record<string, string> = {
  language: 'general',
  email_from_name: 'email',
  email_from_address: 'email',
};

const TYPE_MAP: Record<string, string> = {
  language: 'string',
  email_from_name: 'string',
  email_from_address: 'string',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    // Build upsert rows from allowed keys
    const now = new Date().toISOString();
    const rows = [];

    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        rows.push({
          club_id: id,
          category: CATEGORY_MAP[key] || 'general',
          key,
          value: String(body[key]),
          type: TYPE_MAP[key] || 'string',
          is_public: false,
          is_required: false,
          updated_at: now,
          updated_by: auth.user.id,
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: true, message: 'No settings to save' });
    }

    const { error } = await auth.supabase
      .from('system_settings')
      .upsert(rows, { onConflict: 'club_id, key' });

    if (error) {
      console.error('[Onboarding Settings POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
