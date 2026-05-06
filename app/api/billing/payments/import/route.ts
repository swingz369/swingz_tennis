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
        errors: [] as Array<{ record: CsvPaymentRecord; error: string }>,
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

          await billingEngine.createPayment({
            club_id: auth.clubId,
            member_id: memberId,
            amount: Math.min(Math.max(record.amount, 0), 1000000),
            payment_method: record.paymentMethod,
            payment_date: record.paymentDate,
            transaction_id: record.transactionId,
            notes: record.notes ? record.notes.substring(0, 1000) : undefined,
          });

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
        failed: results.failed,
        invalid: invalid.map((i) => ({ record: i.record, errors: i.errors })),
        errors: results.errors,
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
