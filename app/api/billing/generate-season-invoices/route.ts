import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, verifyClubAccess } from '@/lib/api-auth';
import { SeasonBillingService } from '@/application/services/season-billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:generate-season-invoices');

const Schema = z.object({
  club_id: z.string().uuid(),
  season_id: z.string().uuid(),
  installment_count: z.number().int().min(1).max(3).default(1),
  installment_due_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { club_id, season_id, installment_count, installment_due_dates } = parsed.data;

  if (!verifyClubAccess(auth, club_id)) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
  }

  if (installment_count > 1 && installment_due_dates.length !== installment_count) {
    return NextResponse.json(
      { error: 'installment_due_dates muss installment_count Einträge haben' },
      { status: 400 }
    );
  }

  try {
    const result = await new SeasonBillingService(auth).generateInvoices(season_id);

    if (installment_count > 1 && result.created.length > 0) {
      for (const invoice of result.created) {
        const perInstallment = invoice.totalAmount / installment_count;
        const { error } = await auth.supabase.from('invoice_installments').insert(
          installment_due_dates.map((due_date, i) => ({
            invoice_id: invoice.invoiceId,
            installment_number: i + 1,
            amount: perInstallment,
            due_date,
            status: 'pending',
          }))
        );
        if (error) {
          log.error(
            `Ratenzahlung für Rechnung ${invoice.invoiceId} konnte nicht angelegt werden`,
            new Error(error.message)
          );
        }
      }
    }

    return NextResponse.json({
      created: result.created.length,
      skipped: result.skipped.length,
      errors: result.failed.map((f) => `${f.memberId}: ${f.error}`),
    });
  } catch (e) {
    log.error('Saison-Abrechnung fehlgeschlagen', e instanceof Error ? e : undefined);
    return NextResponse.json({ error: 'Saison-Abrechnung fehlgeschlagen' }, { status: 500 });
  }
}
