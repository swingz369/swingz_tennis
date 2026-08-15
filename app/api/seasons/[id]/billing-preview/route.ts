// POST /api/seasons/[id]/billing-preview — Billing-Vorschau (Fee-Config-Matching)
//
// Reimplementierung der historischen Route
// `app/api/seasons/[id]/wizard/billing-preview/route.ts` (POST), die im Zuge der
// Season-Planning-v2-Migration entfernt wurde. Die Berechnung lebt jetzt als
// pure Funktion in `@/lib/billing/billing-preview` (`computeBillingPreview`),
// die Datenquellen sind die echten Services:
//   - Plan-Einträge:   `season_plan_entries` (Teilnehmer je Eintrag)
//   - Fee-Configs:     `feeConfigurationService.getActiveFeeConfigurations`
//                      (Drizzle-Adapter auf `fee_configurations`, club-scoped)
//
// Antwort: JSON-Array von `BillingPreviewItem` (memberId, groupId, amount,
// feeConfigId, billingCycle, installments) — gleiches Vertragsformat wie die
// historische Route und die UI-Komponente `BillingPreviewTable`.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { feeConfigurationService } from '@/src/application/services/fee-configuration-service.adapter';
import { computeBillingPreview } from '@/lib/billing/billing-preview';
import type { BillingPreviewEntry, BillingPreviewFeeConfig } from '@/lib/billing/billing-preview';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:billing-preview');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      // Tenant-Isolation: verifyRole() allein prüft nur die globale Rolle des
      // Aufrufers, nicht die Mitgliedschaft im Club dieser Saison. Ein Admin
      // von Club A könnte sonst Club B's Vorschau lesen. authorizeSeasonAccess()
      // prüft die Mitgliedschaft gegen season.club_id.
      const access = await authorizeSeasonAccess(auth, seasonId, { allowedRoles: ['admin'] });
      if (!access.ok) return access.response;

      // 1. Plan-Einträge laden (Teilnehmer je Eintrag)
      const { data: entries, error: entriesError } = await (auth.supabase as any)
        .from('season_plan_entries')
        .select('id, group_id, expected_participants')
        .eq('season_id', seasonId);
      if (entriesError) throw new Error(entriesError.message);

      // 2. Fee-Configs über den echten Service laden (aktiv + club-scoped)
      const activeFeeConfigs = await feeConfigurationService.getActiveFeeConfigurations(
        access.season.club_id
      );
      const feeConfigs: BillingPreviewFeeConfig[] = activeFeeConfigs.map((fee) => ({
        id: fee.id,
        amount: fee.amount,
        billing_cycle: fee.billingCycle,
        conditions: fee.conditions,
      }));

      // 3. Teilnehmer je Eintrag zu Preview-Einträgen expandieren
      const previewEntries: BillingPreviewEntry[] = [];
      for (const entry of (entries ?? []) as Array<{
        group_id: string | null;
        expected_participants: string[] | null;
      }>) {
        for (const memberId of entry.expected_participants ?? []) {
          if (!entry.group_id) continue;
          previewEntries.push({ member_id: memberId, group_id: entry.group_id });
        }
      }

      const preview = computeBillingPreview(previewEntries, feeConfigs);
      return NextResponse.json(preview);
    } catch (error) {
      log.error('POST billing-preview error:', error);
      return internalErrorResponse();
    }
  });
}
