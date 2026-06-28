/**
 * ════════════════════════════════════════════════════════════════════════════════
 * app/(protected)/admin/smart-court/page.tsx — Q3 ticket 3.1.3 Server-Component
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Ziel
 *   Adapter-Konfiguration pro Club (siehe 3.1.1 + 3.1.2 + lib/hardware/adapter.ts).
 *   Diese Page ist Club-Level: ein Hardware-Vendor pro Club.
 *   Per-Court-Override ist eine Erweiterung (3.1.4+).
 *
 * Scope (1.0)
 *   ✓ Admin-Rolle (admin/owner/superadmin) — read + write
 *   ✓ Aktive Plätze read-only anzeigen
 *   ✓ Vendor-Selector (Nuki / Shelly / Loxone) — Card-basierte RadioGroup im Client
 *   ✓ ENV-Var-Missing-Warning im Client (UX-Hint vor Save)
 *
 * Out-of-Scope
 *   - Per-Court-Vendor-Override (verfügbar in 3.1.4)
 *   - Multi-Vendor-Setup pro Club (nicht in 1.0 geplant)
 *   - Vendor-Health-Check (Token-Rotation, Connection-Pings) — separate Tickets
 *
 * Pattern (mirror app/(protected)/admin/clubs/[clubId]/billing/page.tsx)
 *   - Server-Component: Auth + Datenladen + Delegation
 *   - Client-Component (`smart-court-client.tsx`): State + PUT + Toast
 *   - API-Route (`app/api/clubs/[id]/hardware-vendor/route.ts`): Zod-validate +
 *     shallow-JSONB-merge in `clubs.features` + audit_logs-Eintrag
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import SmartCourtClient from './smart-court-client';
import type { HardwareVendor } from '@/lib/hardware/adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin:smart-court:page');

type CourtRow = {
  id: string;
  name: string;
  court_type_id: string | null;
  is_active: boolean | null;
};

export default async function SmartCourtPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // No-op (read-only in Server-Component)
        },
      },
    }
  );

  // 1. Auth-Gate
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) {
    redirect('/login?reason=unauthorized&next=/admin/smart-court');
  }

  // 2. Admin-Membership-Resolution
  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('role', ['admin', 'owner', 'superadmin'])
    .limit(1)
    .maybeSingle();

  if (!membership?.club_id) {
    log.warn('No active admin membership for smart-court page access', { user_id: user.id });
    redirect('/admin/dashboard?reason=admin_only');
  }

  const clubId = membership.club_id;

  // 3. Initial-Data-Fetch (parallel)
  const [
    { data: club, error: clubErr },
    { data: courts, error: courtsErr },
  ] = await Promise.all([
    supabase.from('clubs').select('features').eq('id', clubId).maybeSingle(),
    supabase
      .from('courts')
      .select('id, name, court_type_id, is_active')
      .eq('club_id', clubId)
      .order('name', { ascending: true }),
  ]);

  if (clubErr) {
    log.error('Failed to load club features', { club_id: clubId, error: clubErr.message });
  }
  if (courtsErr) {
    log.error('Failed to load courts', { club_id: clubId, error: courtsErr.message });
  }

  // Safe-Cast zum discriminated Union (mongoose-pattern: features ist JSONB)
  const features = (club?.features ?? {}) as Record<string, unknown>;
  const vendorRaw = features.hardware_vendor;
  const initialVendor: HardwareVendor =
    vendorRaw === 'nuki' || vendorRaw === 'shelly' || vendorRaw === 'loxone' ? vendorRaw : 'shelly';

  return (
    <SmartCourtClient
      clubId={clubId}
      initialVendor={initialVendor}
      courts={(courts ?? []) as CourtRow[]}
    />
  );
}
