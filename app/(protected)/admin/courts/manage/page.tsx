import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { CourtsManageClient } from './courts-manage-client';
import type { Court } from '@/lib/booking/court.service';

export default async function AdminCourtsManagePage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  let initialCourts: Court[] = [];
  let courtTypes: Array<{ id: string; name: string; surface: string }> = [];
  let clubId: string | null = null;

  if (hasDemoMode) {
    // Demo courts
    initialCourts = [
      {
        id: 'demo-court-1',
        club_id: 'demo-club',
        court_type_id: 'demo-type-1',
        name: 'Platz 1',
        number: 1,
        surface: 'clay',
        location: 'Hauptgebäude',
        description: 'Sandplatz',
        status: 'available',
        has_lighting: true,
        lighting_hours_start: '08:00',
        lighting_hours_end: '22:00',
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'demo-court-2',
        club_id: 'demo-club',
        court_type_id: 'demo-type-2',
        name: 'Platz 2',
        number: 2,
        surface: 'hard',
        location: 'Hauptgebäude',
        description: 'Hartplatz',
        status: 'available',
        has_lighting: false,
        lighting_hours_start: null,
        lighting_hours_end: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ];
    courtTypes = [
      { id: 'demo-type-1', name: 'Sandplatz', surface: 'clay' },
      { id: 'demo-type-2', name: 'Hartplatz', surface: 'hard' },
    ];
    clubId = 'demo-club';
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Get user's club memberships
    const { data: membershipsData } = await supabase
      .from('user_club_memberships')
      .select('club_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!membershipsData || membershipsData.length === 0) {
      return <div className="p-6 text-red-600">Kein Vereinszugang gefunden</div>;
    }

    const memberships = membershipsData as Array<{ club_id: string; role: string }>;

    const isSuperAdmin = memberships.some((m) => m.role === 'superadmin');
    let effectiveClubId: string;
    if (isSuperAdmin) {
      const selectedClubId = cookieStore.get('selected-club-id')?.value;
      if (selectedClubId && memberships.some((m) => m.club_id === selectedClubId)) {
        effectiveClubId = selectedClubId;
      } else {
        effectiveClubId = memberships[0].club_id;
      }
    } else {
      effectiveClubId = memberships[0].club_id;
    }

    clubId = effectiveClubId;

    // Fetch courts for this club
    const { data: courts } = await supabase
      .from('courts')
      .select('*')
      .eq('club_id', effectiveClubId)
      .order('number', { ascending: true });

    initialCourts = (courts || []) as Court[];

    // Fetch court types
    const { data: types } = await supabase
      .from('court_types')
      .select('id, name, surface_type')
      .eq('is_active', true)
      .order('name', { ascending: true });

    courtTypes = (types || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      surface: t.surface_type,
    }));
  }

  return (
    <CourtsManageClient initialCourts={initialCourts} courtTypes={courtTypes} clubId={clubId!} />
  );
}
