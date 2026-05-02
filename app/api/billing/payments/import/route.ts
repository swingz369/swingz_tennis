import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { CreatePayment, Payment } from '@/lib/types/billing';

interface ImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ line: number; error: string }>;
  payments: Payment[];
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();

    const file = formData.get('file') as File;
    const clubId = formData.get('clubId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID is required' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n');

    // Skip header row
    const dataLines = lines.slice(1).filter((line) => line.trim());

    const results: ImportResult = {
      total: dataLines.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ line: number; error: string }>,
      payments: [] as Payment[],
    };

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const columns = line.split(',').map((col) => col.trim().replace(/^"|"$/g, ''));

      try {
        // Expected CSV format:
        // member_id,invoice_id,amount,payment_method,payment_date,notes
        const [memberId, invoiceId, amount, paymentMethod, paymentDate, notes] = columns;

        if (!memberId || !amount || !paymentMethod) {
          throw new Error('Missing required fields');
        }

        const createPaymentData: CreatePayment = {
          club_id: clubId,
          member_id: memberId,
          invoice_id: invoiceId || undefined,
          amount: parseFloat(amount),
          payment_method: paymentMethod as 'sepa' | 'stripe' | 'cash' | 'bank_transfer' | 'other',
          payment_date: paymentDate || undefined,
          notes: notes || undefined,
        };

        const payment = await billingEngine.createPayment(createPaymentData);

        results.successful++;
        results.payments.push(payment);
      } catch (error) {
        results.failed++;
        results.errors.push({
          line: i + 2, // +2 because we skipped header and 0-indexed
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error('Error importing payments:', error);
    return NextResponse.json({ error: 'Failed to import payments' }, { status: 500 });
  }
}
