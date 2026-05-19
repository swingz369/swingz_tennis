import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createSeasonInvoice } from '@/lib/services/billing.service';

type PreviewItem = {
  memberId: string;
  memberName: string;
  groupId: string;
  amount: number;
  feeConfigId: string | null;
  installments: number;
  override?: { amount?: number; installments?: number };
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    if (!auth.clubId) return NextResponse.json({ error: 'No club context' }, { status: 400 });

    const items: PreviewItem[] = await request.json();
    let generated = 0;
    const errors: string[] = [];

    // Default due date: end of current year
    const defaultDueDate = new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];

    for (const item of items) {
      if (!item.feeConfigId) {
        errors.push(`${item.memberName || item.memberId}: no fee configuration`);
        continue;
      }
      const installments = item.override?.installments ?? item.installments ?? 1;
      try {
        await createSeasonInvoice({
          club_id: auth.clubId,
          member_id: item.memberId,
          season_id: seasonId,
          fee_configuration_id: item.feeConfigId,
          installment_count: installments,
          installment_due_dates:
            installments > 1
              ? Array.from({ length: installments }, (_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + i + 1, 1);
                  return d.toISOString().split('T')[0];
                })
              : [],
          due_date: defaultDueDate,
          created_by: auth.user.id,
        });
        generated++;
      } catch (err: any) {
        errors.push(`${item.memberName || item.memberId}: ${err.message}`);
      }
    }

    return NextResponse.json({ generated, skipped: 0, errors });
  });
}
