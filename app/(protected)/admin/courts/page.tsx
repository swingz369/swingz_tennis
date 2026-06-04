import { requireAdminClub } from '@/lib/admin-context';
import { CourtsPageClient } from './courts-page-client';
import type { Court } from '@/lib/types/court-booking';

export default async function AdminCourtsPage() {
  const { supabase, clubId } = await requireAdminClub();

  const [{ data: courts }, { data: types }] = await Promise.all([
    supabase.from('courts').select('*').eq('club_id', clubId).order('number', { ascending: true }),
    supabase
      .from('court_types')
      .select('id, name, surface_type')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  const courtTypes = (types || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    surface: t.surface_type,
  }));

  return (
    <CourtsPageClient
      clubId={clubId}
      initialCourts={(courts || []) as Court[]}
      courtTypes={courtTypes}
    />
  );
}
