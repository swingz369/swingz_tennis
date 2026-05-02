import { InvoiceWithItems } from '../types/billing';
import InvoicePDF from './invoice-pdf';

export interface InvoicePDFData {
  invoice: InvoiceWithItems;
  clubName: string;
  clubAddress: string;
  clubEmail: string;
  clubPhone: string;
  memberName: string;
  memberAddress: string;
  memberEmail: string;
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  const { pdf } = await import('@react-pdf/renderer');

  const document = (
    <InvoicePDF
      invoice={data.invoice}
      clubName={data.clubName}
      clubAddress={data.clubAddress}
      clubEmail={data.clubEmail}
      clubPhone={data.clubPhone}
      memberName={data.memberName}
      memberAddress={data.memberAddress}
      memberEmail={data.memberEmail}
    />
  );

  const pdfStream = await pdf(document).toBuffer();

  // Convert stream to Buffer
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    pdfStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfStream.on('end', () => resolve(Buffer.concat(chunks)));
    pdfStream.on('error', reject);
  });
}

export async function generateInvoicePDFBase64(data: InvoicePDFData): Promise<string> {
  const buffer = await generateInvoicePDF(data);
  return buffer.toString('base64');
}

export function getInvoiceFileName(invoiceNumber: string): string {
  return `Rechnung-${invoiceNumber}.pdf`;
}

export function getInvoiceEmailSubject(invoiceNumber: string, clubName: string): string {
  return `Ihre Rechnung ${invoiceNumber} von ${clubName}`;
}

export function getInvoiceEmailBody(
  memberName: string,
  invoiceNumber: string,
  totalAmount: number,
  dueDate: string,
  clubName: string
): string {
  const formattedAmount = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(totalAmount);

  const formattedDueDate = new Date(dueDate).toLocaleDateString('de-DE');

  return `
Hallo ${memberName},

anbei erhalten Sie Ihre Rechnung ${invoiceNumber} von ${clubName}.

Rechnungsdetails:
- Rechnungsnummer: ${invoiceNumber}
- Gesamtbetrag: ${formattedAmount}
- Fälligkeitsdatum: ${formattedDueDate}

Bitte überweisen Sie den Betrag bis zum ${formattedDueDate} auf folgendes Konto:

Kontoinhaber: ${clubName}
IBAN: [IBAN einfügen]
BIC: [BIC einfügen]
Verwendungszweck: ${invoiceNumber}

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ${clubName} Team
  `.trim();
}
