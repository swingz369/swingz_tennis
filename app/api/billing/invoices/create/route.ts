import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { CreateInvoice, InvoiceItemType } from '@/lib/types/billing';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const { clubId, memberId, dueDate, items, notes, sendImmediately } = body;

    if (!clubId || !memberId || !dueDate || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one invoice item is required' }, { status: 400 });
    }

    const createInvoiceData: CreateInvoice = {
      club_id: clubId,
      member_id: memberId,
      due_date: dueDate,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity || 1,
        unit_price: parseFloat(item.unit_price),
        tax_rate: parseFloat(item.tax_rate) || 19.0,
        item_type: (item.item_type || 'other') as InvoiceItemType,
        reference_id: item.reference_id,
        reference_type: item.reference_type,
      })),
      notes,
    };

    const invoice = await billingEngine.createInvoice(createInvoiceData);

    if (sendImmediately) {
      await billingEngine.updateInvoiceStatus(invoice.id, 'sent');
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Error creating manual invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
