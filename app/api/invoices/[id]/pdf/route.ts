import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { loadInvoiceIssuer } from '@/lib/pdf/invoice-issuer';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { generateInvoicePDF, getInvoiceFileName } from '@/lib/pdf/invoice-pdf-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:invoices:[id]:pdf');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id: invoiceId } = await params;

      const invoice = await billingEngine.getInvoiceById(invoiceId);

      if (!invoice) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
      }

      // Fremde Rechnung = "nicht gefunden": Existenz nicht verraten. billingEngine liest ohne RLS.
      const inClub =
        auth.role === 'owner' || auth.memberships.some((m) => m.club_id === invoice.club_id);
      if (!inClub) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
      }

      const isAdminOrTrainer = await verifyRole(auth, 'trainer');
      const isOwner = invoice.member_id === auth.user.id;

      if (!isAdminOrTrainer && !isOwner) {
        return forbiddenResponse(
          'Zugriff verweigert — du kannst nur deine eigenen Rechnungen einsehen'
        );
      }

      // Rechnungssteller und Empfänger kommen aus der Rechnung, nicht aus dem Betrachter
      const issuer = await loadInvoiceIssuer(auth.supabase, invoice.club_id);
      if (!issuer) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
      }
      const { data: member } = invoice.member_id
        ? await auth.supabase
            .from('users')
            .select('full_name, email')
            .eq('id', invoice.member_id)
            .maybeSingle()
        : { data: null };

      const pdfBuffer = await generateInvoicePDF({
        invoice,
        ...issuer,
        memberName: member?.full_name || 'Mitglied',
        memberAddress: '',
        memberEmail: member?.email || '',
      });

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${getInvoiceFileName(invoice.invoice_number)}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } catch (error) {
      log.error('Error generating invoice PDF:', error);
      return NextResponse.json({ error: 'PDF konnte nicht erstellt werden' }, { status: 500 });
    }
  });
}
