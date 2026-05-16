import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiAuth } from '@/lib/api-auth';

// GET /api/admin/approvals — returns registration requests (admin only)
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('demo-mode')) {
    return NextResponse.json({ registrations: [] });
  }

  return withApiAuth(req, async (auth) => {
    if (auth.role !== 'admin' && auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (auth.supabase as any)
      .from('registration_requests')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (auth.role !== 'superadmin' && auth.clubId) {
      query = query.eq('club_id', auth.clubId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }
    if (search) {
      query = query.or(
        `applicant_first_name.ilike.%${search}%,applicant_last_name.ilike.%${search}%,applicant_email.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      // Table may not exist yet — return empty gracefully
      return NextResponse.json({ registrations: [] });
    }

    // Map DB columns to RegistrationRequest interface
    const registrations = (data ?? []).map((r: any) => ({
      id: r.id,
      type: r.type || 'registration',
      status: r.status || 'pending',
      applicant: {
        firstName: r.applicant_first_name || '',
        lastName: r.applicant_last_name || '',
        email: r.applicant_email || '',
        phone: r.applicant_phone || '',
        dateOfBirth: r.applicant_date_of_birth || '',
      },
      address: {
        street: r.address_street || '',
        houseNumber: r.address_house_number || '',
        postalCode: r.address_postal_code || '',
        city: r.address_city || '',
      },
      tennisInfo: {
        experience: r.tennis_experience || '',
        playingLevel: r.tennis_playing_level || '',
        preferredDays: r.tennis_preferred_days || [],
        goals: r.tennis_goals || '',
      },
      additionalInfo: r.additional_info || undefined,
      submittedAt: r.submitted_at || new Date().toISOString(),
      reviewedAt: r.reviewed_at || undefined,
      reviewedBy: r.reviewed_by || undefined,
      rejectionReason: r.rejection_reason || undefined,
      notes: r.notes || undefined,
    }));

    return NextResponse.json({ registrations });
  });
}

// PATCH /api/admin/approvals — approve, reject, or hold a registration
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('demo-mode')) {
    return NextResponse.json({ success: true });
  }

  return withApiAuth(req, async (auth) => {
    if (auth.role !== 'admin' && auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, rejectionReason, notes } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
    }

    if (!['approve', 'reject', 'hold', 'update_notes'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approve, reject, hold, or update_notes' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json(
        { error: 'rejectionReason is required for reject action' },
        { status: 400 }
      );
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      hold: 'on_hold',
    };

    // update_notes only changes notes, not status
    const updateData: Record<string, any> =
      action === 'update_notes'
        ? {}
        : {
            status: statusMap[action],
            reviewed_at: new Date().toISOString(),
            reviewed_by: auth.user.email || 'Unknown',
          };

    if (rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (auth.supabase as any)
      .from('registration_requests')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
