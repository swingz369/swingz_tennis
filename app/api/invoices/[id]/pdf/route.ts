import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { generateInvoicePDF, getInvoiceFileName } from '@/lib/pdf/invoice-pdf-utils';

export async function GET(_____request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth();
    const { id: invoiceId } = await params;

    const invoice = await billingEngine.getInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.member_id !== user.id) {
      // TODO: Implement proper club-based access control
      // The current implementation expects userClub to have clubs and role properties,
      // but getUserFromCookies returns a Supabase User which doesn't have these
      // For now, only allow users to access their own invoices
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const pdfBuffer = await generateInvoicePDF({
      invoice,
      clubName: 'SWINGZ Tennis Club',
      clubAddress: 'Musterstraße 123, 12345 Musterstadt',
      clubEmail: 'info@swingz.de',
      clubPhone: '+49 123 456789',
      memberName: user.user_metadata?.full_name || 'Mitglied',
      memberAddress: 'Mitgliedadresse',
      memberEmail: user.email || '',
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
}
