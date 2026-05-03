import { parse } from 'csv-parse/sync';

export interface CsvPaymentRecord {
  paymentNumber?: string;
  paymentDate: string;
  amount: number;
  paymentMethod: 'sepa' | 'stripe' | 'cash' | 'bank_transfer' | 'other';
  memberId?: string;
  memberEmail?: string;
  invoiceNumber?: string;
  transactionId?: string;
  notes?: string;
}

function sanitizeCsvField(value: string): string {
  if (!value) return value;

  return value
    .replace(/^=/, "'=")
    .replace(/^@/, "'@")
    .replace(/^\+/, "'+")
    .replace(/^-/, "'-")
    .replace(/^0/, "'0")
    .replace(/\t/g, '    ')
    .replace(/\r?\n/g, ' ');
}

export function parsePaymentCsv(csvContent: string): CsvPaymentRecord[] {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    return records.map((record: any) => ({
      paymentNumber: sanitizeCsvField(record['Zahlungsnummer'] || record['payment_number'] || ''),
      paymentDate: sanitizeCsvField(record['Zahlungsdatum'] || record['payment_date'] || new Date().toISOString().split('T')[0]),
      amount: parseFloat(record['Betrag'] || record['amount'] || '0'),
      paymentMethod: normalizePaymentMethod(record['Zahlungsmethode'] || record['payment_method'] || 'other'),
      memberId: sanitizeCsvField(record['Mitglied-ID'] || record['member_id'] || ''),
      memberEmail: sanitizeCsvField(record['Mitglied-Email'] || record['member_email'] || ''),
      invoiceNumber: sanitizeCsvField(record['Rechnungsnummer'] || record['invoice_number'] || ''),
      transactionId: sanitizeCsvField(record['Transaktions-ID'] || record['transaction_id'] || ''),
      notes: sanitizeCsvField(record['Notizen'] || record['notes'] || ''),
    }));
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw new Error('Failed to parse CSV file');
  }
}

function normalizePaymentMethod(method: string): 'sepa' | 'stripe' | 'cash' | 'bank_transfer' | 'other' {
  const normalized = method.toLowerCase().trim();

  if (['sepa', 'lastschrift', 'direct debit'].includes(normalized)) {
    return 'sepa';
  }
  if (['stripe', 'kreditkarte', 'credit card', 'card'].includes(normalized)) {
    return 'stripe';
  }
  if (['bar', 'cash'].includes(normalized)) {
    return 'cash';
  }
  if (['überweisung', 'bank transfer', 'transfer'].includes(normalized)) {
    return 'bank_transfer';
  }

  return 'other';
}

export function validatePaymentRecords(records: CsvPaymentRecord[]): {
  valid: CsvPaymentRecord[];
  invalid: Array<{ record: CsvPaymentRecord; errors: string[] }>;
} {
  const valid: CsvPaymentRecord[] = [];
  const invalid: Array<{ record: CsvPaymentRecord; errors: string[] }> = [];

  records.forEach((record) => {
    const errors: string[] = [];

    if (!record.paymentDate) {
      errors.push('Zahlungsdatum fehlt');
    }

    if (isNaN(record.amount) || record.amount <= 0) {
      errors.push('Ungültiger Betrag');
    }

    if (record.amount > 1000000) {
      errors.push('Betrag überschreitet Maximum von 1.000.000€');
    }

    if (!record.memberId && !record.memberEmail) {
      errors.push('Mitglied-ID oder Mitglied-Email erforderlich');
    }

    if (errors.length > 0) {
      invalid.push({ record, errors });
    } else {
      valid.push(record);
    }
  });

  return { valid, invalid };
}

export function generatePaymentCsvTemplate(): string {
  const headers = [
    'Zahlungsnummer',
    'Zahlungsdatum',
    'Betrag',
    'Zahlungsmethode',
    'Mitglied-ID',
    'Mitglied-Email',
    'Rechnungsnummer',
    'Transaktions-ID',
    'Notizen',
  ];

  const exampleRow = [
    'PAY-202605-00001',
    '2026-05-15',
    '29.99',
    'sepa',
    'uuid-mitglied-id',
    'mitglied@example.com',
    'INV-202605-00001',
    'transaction-123',
    'Beispielnotiz',
  ];

  return [headers.join(','), exampleRow.join(',')].join('\n');
}

export function getCsvFileName(): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `zahlungen-import-${date}.csv`;
}
