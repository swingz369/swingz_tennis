import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { CreateInvoice } from '@/lib/types/billing';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:invoices:create');

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Permission check (trainer or admin)
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    // Rate limit
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Validate club context
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Vereins Kontext erforderlich' }, { status: 400 });
    }

    const clubId = auth.clubId!;

    try {
      const body = await _request.json();
      const { member_id, due_date, items, notes } = body;

      if (!member_id) {
        return NextResponse.json({ error: 'Mitglied-ID ist erforderlich' }, { status: 400 });
      }

      if (!due_date) {
        return NextResponse.json({ error: 'Fälligkeitsdatum ist erforderlich' }, { status: 400 });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'Positionen müssen ein nicht-leeres Array sein' },
          { status: 400 }
        );
      }

      if (items.length > 100) {
        return NextResponse.json(
          { error: 'Maximal 100 Positionen pro Rechnung erlaubt' },
          { status: 400 }
        );
      }

      const validItems = items.filter(
        (item: any) => item.description && item.quantity > 0 && item.unitPrice >= 0
      );

      if (validItems.length === 0) {
        return NextResponse.json(
          { error: 'Mindestens eine gültige Position ist erforderlich' },
          { status: 400 }
        );
      }

      // Verify that the target member belongs to the same club as the issuer
      const supabase = auth.supabase;
      const { data: memberMembership, error: membershipError } = await supabase
        .from('user_club_memberships')
        .select('club_id')
        .eq('user_id', member_id)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .single();

      if (membershipError || !memberMembership) {
        return NextResponse.json(
          { error: 'Mitglied gehört nicht zum aktuellen Verein oder ist inaktiv' },
          { status: 403 }
        );
      }

      // Build invoice data
      const createInvoiceData: CreateInvoice = {
        club_id: clubId,
        member_id,
        due_date,
        items: validItems.map((item: any) => ({
          description: item.description.substring(0, 500),
          quantity: Math.min(Math.max(item.quantity, 1), 1000),
          unit_price: Math.min(Math.max(item.unitPrice, 0), 1000000),
          tax_rate: Math.min(Math.max(item.taxRate || 19, 0), 100),
          item_type: [
            'membership_fee',
            'training_fee',
            'court_fee',
            'dunning_fee',
            'other',
          ].includes(item.itemType)
            ? item.itemType
            : 'other',
        })),
        notes: notes ? notes.substring(0, 1000) : undefined,
      };

      const invoice = await billingEngine.createInvoice(createInvoiceData);

      return NextResponse.json(invoice, { status: 201 });
    } catch (error) {
      log.error('Error creating invoice:', error);
      return internalErrorResponse();
    }
  });
}
