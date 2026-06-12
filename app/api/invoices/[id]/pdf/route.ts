import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { generateInvoicePDF, getInvoiceFileName } from '@/lib/pdf/invoice-pdf-utils';

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
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const isAdminOrTrainer = await verifyRole(auth, 'trainer');
      const isOwner = invoice.member_id === auth.user.id;

      if (!isAdminOrTrainer && !isOwner) {
        return forbiddenResponse('Access denied - you can only view your own invoices');
      }

      // Fetch club info for PDF header
      const clubId = auth.clubId;
      let clubData: {
        name?: string | null;
        address?: string | null;
        email?: string | null;
        phone?: string | null;
      } | null = null;
      if (clubId) {
        const { data } = await auth.supabase
          .from('clubs')
          .select('name, address, email, phone')
          .eq('id', clubId)
          .maybeSingle();
        clubData = data;
      }

      const pdfBuffer = await generateInvoicePDF({
        invoice,
        clubName: clubData?.name || 'SWINGZ Tennis Club',
        clubAddress: clubData?.address || '',
        clubEmail: clubData?.email || 'info@swingz.cloud',
        clubPhone: clubData?.phone || '',
        memberName: auth.user.user_metadata?.full_name || 'Mitglied',
        memberAddress: '',
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
