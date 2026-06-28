// =============================================================================
// app/api/admin/newsletter/campaigns/route.ts — TICKET 2.5.3
// =============================================================================
//
// POST /api/admin/newsletter/campaigns
//   Body: { clubId, templateId, name, recipientFilter, customRecipientIds?,
//           subject, bodyHtml, bodyText, scheduledAt? }
//   Response: { campaignId, recipientCount, costEstimatedEur, status }
//   Auth: requires admin role + cookie-based clubId match
// =============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  composeCampaign,
  scheduleCampaign,
  executeCampaign,
} from '@/lib/services/newsletter/send-newsletter.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:newsletter:campaigns');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateCampaignRequest {
  clubId: string;
  templateId: string;
  name: string;
  recipientFilter: 'all_club' | 'active_members' | 'inactive_members' | 'custom';
  customRecipientIds?: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  scheduledAt?: string;
  /** If true, immediately executes after compose. Default: true for non-scheduled. */
  executeImmediately?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Cookie-Cluster-Resolution
    const cookieStore = await cookies();
    const cookieClubId = cookieStore.get('tenant-club')?.value ?? null;
    if (!cookieClubId) {
      return NextResponse.json({ error: 'Missing tenant-club cookie' }, { status: 400 });
    }

    // 3. Body-Parse
    const body = (await req.json()) as CreateCampaignRequest;
    if (!body.clubId || body.clubId !== cookieClubId) {
      return NextResponse.json({ error: 'clubId mismatch with cookie tenant' }, { status: 403 });
    }
    if (!body.templateId || !body.name || !body.subject || !body.bodyHtml) {
      return NextResponse.json(
        { error: 'templateId, name, subject, bodyHtml sind erforderlich' },
        { status: 400 }
      );
    }

    // 4. Compose (mit Wizard-Overrides — BLOCKER-Fix)
    const composed = await composeCampaign({
      clubId: body.clubId,
      templateId: body.templateId,
      name: body.name,
      recipientFilter: body.recipientFilter,
      customRecipientIds: body.customRecipientIds,
      subjectOverride: body.subject,
      bodyHtmlOverride: body.bodyHtml,
      bodyTextOverride: body.bodyText,
    });
    if (!composed) {
      return NextResponse.json(
        {
          error: 'Compose fehlgeschlagen — Template nicht gefunden oder Cost-Budget überschritten',
        },
        { status: 400 }
      );
    }

    // 5. Optional: Schedule
    let scheduled = false;
    if (body.scheduledAt) {
      const sendAt = new Date(body.scheduledAt);
      const schedResult = await scheduleCampaign({
        campaignId: composed.campaignId,
        sendAt,
      });
      if (!schedResult.ok) {
        return NextResponse.json(
          { error: `Schedule fehlgeschlagen: ${schedResult.error}` },
          { status: 400 }
        );
      }
      scheduled = true;
    }

    // 6. Optional: Immediate execute
    let executeResult = null;
    if (!scheduled && (body.executeImmediately ?? true)) {
      executeResult = await executeCampaign({ campaignId: composed.campaignId });
    }

    log.info('Campaign created', {
      campaignId: composed.campaignId,
      scheduled,
      executeSent: executeResult?.sent,
    });

    return NextResponse.json({
      campaignId: composed.campaignId,
      recipientCount: composed.recipientCount,
      costEstimatedEur: composed.costEstimatedEur,
      status: scheduled ? 'scheduled' : (executeResult?.status ?? 'draft'),
      executeResult: executeResult ?? undefined,
    });
  } catch (err) {
    log.error('Newsletter-Campaign-POST fehlgeschlagen', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
