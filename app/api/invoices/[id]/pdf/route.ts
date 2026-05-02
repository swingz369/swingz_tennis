import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { generateInvoicePDF, getInvoiceFileName } from '@/lib/pdf/invoice-pdf-utils';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const invoiceId = params.id;

    const invoice = await billingEngine.getInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.member_id !== user.id) {
      const userClub = await getAuthenticatedUser(request);
      const hasAccess = userClub?.clubs?.some(
        (club: { id: string }) => club.id === invoice.club_id && 
        ['admin', 'superadmin'].includes(userClub.role)
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const pdfBuffer = await generateInvoicePDF({
      invoice,
      clubName: 'SWINGZ Tennis Club',
      clubAddress: 'Musterstraße 123, 12345 Musterstadt',
      clubEmail: 'info@swingz.de',
      clubPhone: '+49 123 456789',
      memberName: user.full_name || 'Mitglied',
      memberAddress: 'Mitgliedadresse',
      memberEmail: user.email || '',
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${getInvoiceFileName(invoice.invoice_number)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
