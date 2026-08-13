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
import { sanitizeFeatureFlags } from '@/lib/features';

/**
 * Feature-Flags eines Vereins — immer als vollständige Map.
 *
 * Der rohe DB-Wert ist bei neu angelegten Vereinen `{}` (die Defaults setzt
 * erst der Onboarding-Wizard). Ohne `sanitizeFeatureFlags` gälte damit jedes
 * Modul als deaktiviert, auch die vier Kernmodule, die gar nicht abschaltbar
 * sind. Der Client-Hook `useClubFeatures` normalisiert bereits genauso — hier
 * verhindert es, dass Server- und Client-Sicht auseinanderlaufen.
 */
export async function getClubFeatures(
  supabase: SupabaseClient,
  clubId: string
): Promise<Record<string, boolean>> {
  const { data } = await supabase.from('clubs').select('features').eq('id', clubId).single();
  return sanitizeFeatureFlags(data?.features as Record<string, unknown> | null);
}

export function featureDisabledResponse(feature: string) {
  return NextResponse.json(
    { error: `Modul '${feature}' ist für diesen Verein nicht aktiviert` },
    { status: 403 }
  );
}
