/**
 * Feature-Flag Guard helpers for optional API modules.
 *
 * Usage in a route handler (after withApiAuth):
 *   if (auth.clubId) {
 *     const features = await getClubFeatures(auth.supabase, auth.clubId);
 *     if (!features.shop) return featureDisabledResponse('shop');
 *   }
 */
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getClubFeatures(
  supabase: SupabaseClient,
  clubId: string
): Promise<Record<string, boolean>> {
  const { data } = await supabase.from('clubs').select('features').eq('id', clubId).single();
  return (data?.features as Record<string, boolean>) ?? {};
}

export function featureDisabledResponse(feature: string) {
  return NextResponse.json(
    { error: `Modul '${feature}' ist für diesen Verein nicht aktiviert` },
    { status: 403 }
  );
}
