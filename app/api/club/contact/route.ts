import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';

/**
 * GET /api/club/contact
 * Returns the club's public contact details (address, phone, email) from the
 * system_settings table.  Falls back to empty strings when settings are not
 * configured so callers never receive hardcoded demo data.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const clubId = auth.clubId;

    if (!clubId) {
      return NextResponse.json({ address: '', phone: '', email: '' });
    }

    const { data: rows } = await auth.supabase
      .from('system_settings')
      .select('key, value')
      .eq('club_id', clubId)
      .in('key', ['club_address', 'club_phone', 'club_email']);

    const settings: Record<string, string> = {};
    for (const row of rows ?? []) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({
      address: settings['club_address'] ?? '',
      phone: settings['club_phone'] ?? '',
      email: settings['club_email'] ?? '',
    });
  });
}
