import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { generateInvoicePDF, getInvoiceFileName } from '@/lib/pdf/invoice-pdf-utils';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id: invoiceId } = await params;

      const invoice = await billingEngine.getInvoiceById(invoiceId);

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const isAdminOrTrainer = await verifyRole(auth, 'trainer');
      const isOwner = invoice.member_id === auth.user.id;

      if (!isAdminOrTrainer && !isOwner) {
        return forbiddenResponse('Access denied - you can only view your own invoices');
      }

      const pdfBuffer = await generateInvoicePDF({
        invoice,
        clubName: 'SWINGZ Tennis Club',
        clubAddress: 'Musterstraße 123, 12345 Musterstadt',
        clubEmail: 'info@swingz.de',
        clubPhone: '+49 123 456789',
        memberName: auth.user.user_metadata?.full_name || 'Mitglied',
        memberAddress: 'Mitgliedadresse',
        memberEmail: auth.user.email || '',
      });

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${getInvoiceFileName(invoice.invoice_number)}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
  });
}
