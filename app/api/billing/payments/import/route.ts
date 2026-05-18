import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { CsvPaymentRecord } from '@/lib/csv/payment-import';
import { parsePaymentCsv, validatePaymentRecords } from '@/lib/csv/payment-import';
import { createClient } from '@/infrastructure/external/supabase/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RECORDS = 1000;

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);

      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Admin access required');
      }

      // Validate club context
      if (!auth.clubId) {
        return NextResponse.json({ error: 'Vereins Kontext erforderlich' }, { status: 400 });
      }

      const formData = await _request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ error: 'Keine Datei bereitgestellt' }, { status: 400 });
      }

      if (!file.name.endsWith('.csv')) {
        return NextResponse.json({ error: 'Datei muss eine CSV sein' }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Dateigröße überschreitet 10MB Limit' }, { status: 413 });
      }

      const supabase = await createClient();

      const csvContent = await file.text();
      const records = parsePaymentCsv(csvContent);

      if (records.length > MAX_RECORDS) {
        return NextResponse.json(
          { error: `Maximal ${MAX_RECORDS} Datensätze pro Import erlaubt` },
          { status: 400 }
        );
      }

      const { valid, invalid } = validatePaymentRecords(records);

      if (valid.length === 0) {
        return NextResponse.json(
          {
            error: 'Keine gültigen Datensätze gefunden',
            invalid: invalid.map((i) => ({ record: i.record, errors: i.errors })),
          },
          { status: 400 }
        );
      }

      const results = {
        imported: 0,
        failed: 0,
        matched: 0,
        unmatched: 0,
        errors: [] as Array<{ record: CsvPaymentRecord; error: string }>,
        unmatchedPayments: [] as Array<{ record: CsvPaymentRecord; paymentId: string }>,
      };

      for (const record of valid) {
        try {
          let memberId = record.memberId;

          if (!memberId && record.memberEmail) {
            const { data: memberData } = await supabase
              .from('users')
              .select('id')
              .eq('email', record.memberEmail)
              .single();

            if (memberData) {
              memberId = memberData.id;
            }
          }

          if (!memberId) {
            results.failed++;
            results.errors.push({
              record,
              error: 'Mitglied nicht gefunden',
            });
            continue;
          }

          // Attempt to match the payment to an invoice
          let invoiceId: string | null = null;

          // Strategy 1: match by invoice number from CSV
          if (record.invoiceNumber) {
            const { data: invoiceByNumber } = await supabase
              .from('invoices')
              .select('id')
              .eq('invoice_number', record.invoiceNumber)
              .eq('club_id', auth.clubId)
              .single();
            if (invoiceByNumber) {
              invoiceId = invoiceByNumber.id;
            }
          }

          // Strategy 2: match by member_id + amount + approximate date (±30 days)
          if (!invoiceId && memberId) {
            const paymentDate = new Date(record.paymentDate);
            const dateFrom = new Date(paymentDate);
            dateFrom.setDate(dateFrom.getDate() - 30);
            const dateTo = new Date(paymentDate);
            dateTo.setDate(dateTo.getDate() + 30);

            const { data: invoiceByMember } = await supabase
              .from('invoices')
              .select('id')
              .eq('member_id', memberId)
              .eq('amount', record.amount)
              .neq('status', 'paid')
              .gte('due_date', dateFrom.toISOString().split('T')[0])
              .lte('due_date', dateTo.toISOString().split('T')[0])
              .limit(1)
              .single();
            if (invoiceByMember) {
              invoiceId = invoiceByMember.id;
            }
          }

          const payment = await billingEngine.createPayment({
            amount: Math.min(Math.max(record.amount, 0), 1000000),
            payment_method: record.paymentMethod,
            external_id: record.transactionId || null,
            invoice_id: invoiceId ?? undefined,
          });

          if (invoiceId) {
            results.matched++;
          } else {
            console.warn(
              `[payment-import] No invoice match for record: memberId=${memberId}, amount=${record.amount}, date=${record.paymentDate}, paymentId=${payment.id}`
            );
            results.unmatched++;
            results.unmatchedPayments.push({ record, paymentId: payment.id });
          }

          results.imported++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            record,
            error: error instanceof Error ? error.message : 'Unbekannter Fehler',
          });
        }
      }

      return NextResponse.json({
        success: true,
        total: records.length,
        imported: results.imported,
        matched: results.matched,
        unmatched: results.unmatched,
        failed: results.failed,
        invalid: invalid.map((i) => ({ record: i.record, errors: i.errors })),
        errors: results.errors,
        unmatchedPayments: results.unmatchedPayments,
      });
    } catch (error) {
      console.error('Error importing payments:', error);
      const isDevelopment = process.env.NODE_ENV === 'development';
      const message =
        isDevelopment && error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
