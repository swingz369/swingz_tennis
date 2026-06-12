/**
 * POST /api/billing/invoices/[id]/send-email
 * Generates a PDF invoice and sends it to the member via email.
 * Also updates the invoice status to 'sent'.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { generateInvoicePDF, getInvoiceFileName } from '@/lib/pdf/invoice-pdf-utils';
import { Resend } from 'resend';
import { env } from '@/lib/env';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    try {
      const { id: invoiceId } = await context.params;

      const invoice = await billingEngine.getInvoiceById(invoiceId);
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      // Fetch club info for PDF header
      const clubId = auth.clubId ?? '';
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

      // Fetch member info for email
      if (!invoice.member_id) {
        return NextResponse.json(
          { error: 'Rechnung hat kein Mitglied zugeordnet' },
          { status: 400 }
        );
      }

      const { data: memberData } = await auth.supabase
        .from('users')
        .select('email, full_name')
        .eq('id', invoice.member_id)
        .maybeSingle();

      const memberEmail = memberData?.email;
      if (!memberEmail) {
        return NextResponse.json({ error: 'Mitglied hat keine E-Mail-Adresse' }, { status: 400 });
      }

      // Generate PDF
      const pdfBuffer = await generateInvoicePDF({
        invoice,
        clubName: clubData?.name || 'SWINGZ Tennis Club',
        clubAddress: clubData?.address || '',
        clubEmail: clubData?.email || 'info@swingz.cloud',
        clubPhone: clubData?.phone || '',
        memberName: memberData?.full_name || 'Mitglied',
        memberAddress: '',
        memberEmail,
      });

      // Send email with PDF attachment via Resend
      if (!env.RESEND_API_KEY) {
        return NextResponse.json(
          { error: 'E-Mail-Versand nicht konfiguriert (RESEND_API_KEY fehlt)' },
          { status: 500 }
        );
      }

      const resend = new Resend(env.RESEND_API_KEY);
      const fromEmail = env.EMAIL_FROM || 'SWINGZ <noreply@swingz.cloud>';
      const clubName = clubData?.name || 'SWINGZ Tennis Club';
      const fileName = getInvoiceFileName(invoice.invoice_number);

      // Format amount for email
      const formattedAmount = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: invoice.currency || 'EUR',
      }).format(invoice.amount);

      const formattedDueDate = invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString('de-DE')
        : 'auf Anfrage';

      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: memberEmail,
        subject: `Ihre Rechnung ${invoice.invoice_number} von ${clubName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Rechnung ${invoice.invoice_number}</h2>
            <p>Hallo ${memberData?.full_name || 'Mitglied'},</p>
            <p>anbei erhalten Sie Ihre Rechnung von <strong>${clubName}</strong>.</p>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Rechnungsnummer:</strong> ${invoice.invoice_number}</p>
              <p style="margin: 4px 0;"><strong>Gesamtbetrag:</strong> ${formattedAmount}</p>
              <p style="margin: 4px 0;"><strong>Fälligkeitsdatum:</strong> ${formattedDueDate}</p>
            </div>
            <p>Die Rechnung finden Sie als PDF-Anlage in dieser E-Mail.</p>
            <p>Bitte überweisen Sie den Betrag bis zum ${formattedDueDate} auf das in der Rechnung angegebene Konto.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
              Bei Fragen stehen wir Ihnen gerne zur Verfügung.<br/>
              Mit freundlichen Grüßen,<br/>
              ${clubName}
            </p>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer.toString('base64'),
          },
        ],
      });

      if (emailError) {
        console.error('[SendInvoiceEmail] Resend error:', emailError);
        return NextResponse.json(
          { error: `E-Mail-Versand fehlgeschlagen: ${emailError.message}` },
          { status: 500 }
        );
      }

      // Update invoice status to 'sent'
      await billingEngine.updateInvoiceStatus(invoiceId, 'sent');

      return NextResponse.json({
        success: true,
        message: `Rechnung ${invoice.invoice_number} an ${memberEmail} versendet`,
      });
    } catch (error) {
      console.error('[SendInvoiceEmail] Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to send invoice email' },
        { status: 500 }
      );
    }
  });
}
