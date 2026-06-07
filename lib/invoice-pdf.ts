import { format } from 'date-fns';
import { de } from '@/lib/locale';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  customerName: string;
  customerEmail: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: 'paid' | 'pending' | 'overdue';
  notes?: string;
}

/**
 * Generate PDF invoice using browser's print functionality
 * This creates a printable HTML invoice that can be saved as PDF
 */
export function generateInvoiceHTML(invoice: Invoice): string {
  const formattedIssueDate = format(invoice.issueDate, 'dd. MMMM yyyy', { locale: de });
  const formattedDueDate = format(invoice.dueDate, 'dd. MMMM yyyy', { locale: de });

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    paid: 'Bezahlt',
    pending: 'Ausstehend',
    overdue: 'Überfällig',
  };

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoice.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }

    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }

    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }

    .invoice-details {
      text-align: right;
    }

    .invoice-number {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
    }

    .invoice-date {
      color: #6b7280;
      font-size: 14px;
    }

    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      margin-top: 8px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 15px;
    }

    .customer-info,
    .company-info {
      background: #f9fafb;
      padding: 20px;
      border-radius: 6px;
    }

    .info-row {
      margin-bottom: 8px;
    }

    .info-label {
      font-weight: 500;
      color: #6b7280;
      margin-right: 8px;
    }

    .info-value {
      color: #1f2937;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    .items-table th,
    .items-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .items-table th {
      background: #f9fafb;
      font-weight: 600;
      color: #1f2937;
    }

    .items-table td {
      color: #4b5563;
    }

    .items-table .text-right {
      text-align: right;
    }

    .totals {
      margin-top: 20px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .total-row:last-child {
      border-bottom: none;
      font-weight: bold;
      font-size: 18px;
      color: #1f2937;
      padding-top: 15px;
    }

    .notes {
      background: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin-top: 30px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .invoice-container {
        box-shadow: none;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="logo">SwingZ Tennis Club</div>
      <div class="invoice-details">
        <div class="invoice-number">Rechnung #${invoice.invoiceNumber}</div>
        <div class="invoice-date">
          Rechnungsdatum: ${formattedIssueDate}<br>
          Fälligkeitsdatum: ${formattedDueDate}
        </div>
        <div class="status ${statusColors[invoice.status]}">
          ${statusLabels[invoice.status]}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Rechnungsempfänger</div>
      <div class="customer-info">
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-value">${invoice.customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">E-Mail:</span>
          <span class="info-value">${invoice.customerEmail}</span>
        </div>
        ${
          invoice.customerAddress
            ? `
        <div class="info-row">
          <span class="info-label">Adresse:</span>
          <span class="info-value">${invoice.customerAddress}</span>
        </div>
        `
            : ''
        }
      </div>
    </div>

    <div class="section">
      <div class="section-title">Rechnungsdetails</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Beschreibung</th>
            <th class="text-right">Menge</th>
            <th class="text-right">Einzelpreis</th>
            <th class="text-right">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items
            .map(
              (item) => `
            <tr>
              <td>${item.description}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">€${item.unitPrice.toFixed(2)}</td>
              <td class="text-right">€${item.total.toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Zwischensumme</span>
          <span>€${invoice.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>MwSt. (${(invoice.taxRate * 100).toFixed(0)}%)</span>
          <span>€${invoice.taxAmount.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Gesamtbetrag</span>
          <span>€${invoice.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${
      invoice.notes
        ? `
    <div class="section">
      <div class="section-title">Bemerkungen</div>
      <div class="notes">
        ${invoice.notes}
      </div>
    </div>
    `
        : ''
    }

    <div class="footer">
      <p>SwingZ Tennis Club Management System</p>
      <p>Diese Rechnung wurde automatisch generiert.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Download invoice as PDF using browser print functionality
 */
export function downloadInvoicePDF(invoice: Invoice): void {
  const html = generateInvoiceHTML(invoice);

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for the content to load, then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}

/**
 * Generate sample invoice for testing
 */
export function generateSampleInvoice(memberData: any): Invoice {
  const now = new Date();
  const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

  const items: InvoiceItem[] = [
    {
      description: 'Monatliches Mitgliedschaft',
      quantity: 1,
      unitPrice: 49.9,
      total: 49.9,
    },
    {
      description: 'Trainingsgebühr (4 Sessions)',
      quantity: 4,
      unitPrice: 15.0,
      total: 60.0,
    },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxRate = 0.19; // 19% MwSt
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  return {
    id: `inv-${Date.now()}`,
    invoiceNumber: `INV-${format(now, 'yyyyMM')}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`,
    issueDate: now,
    dueDate,
    customerName: memberData?.fullName || 'Mitglied',
    customerEmail: memberData?.email || 'mitglied@example.com',
    customerAddress: memberData?.address || undefined,
    items,
    subtotal,
    taxRate,
    taxAmount,
    total,
    status: 'pending',
    notes: 'Vielen Dank für Ihren Beitrag zum SwingZ Tennis Club.',
  };
}

/**
 * Generate invoice from booking data
 */
export function generateInvoiceFromBookings(bookings: any[], memberData: any): Invoice {
  const now = new Date();
  const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const items: InvoiceItem[] = bookings.map((booking) => ({
    description: `Training am ${format(new Date(booking.timeslotStart), 'dd. MMMM yyyy', { locale: de })}`,
    quantity: 1,
    unitPrice: 15.0,
    total: 15.0,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxRate = 0.19;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  return {
    id: `inv-${Date.now()}`,
    invoiceNumber: `INV-${format(now, 'yyyyMM')}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`,
    issueDate: now,
    dueDate,
    customerName: memberData?.fullName || 'Mitglied',
    customerEmail: memberData?.email || 'mitglied@example.com',
    customerAddress: memberData?.address || undefined,
    items,
    subtotal,
    taxRate,
    taxAmount,
    total,
    status: 'pending',
    notes: `Rechnung für ${bookings.length} Trainingssessions.`,
  };
}
