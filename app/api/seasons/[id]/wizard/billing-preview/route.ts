import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();

    const [{ data: entries, error: eErr }, { data: feeConfigs, error: fErr }] = await Promise.all([
      (auth.supabase as any)
        .from('season_plan_entries')
        .select('member_id, group_id')
        .eq('season_id', seasonId),
      (auth.supabase as any)
        .from('fee_configurations')
        .select('*')
        .eq('club_id', auth.clubId)
        .eq('is_active', true),
    ]);
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

    const preview = ((entries as any[]) ?? []).map((entry: any) => {
      const fee =
        ((feeConfigs as any[]) ?? []).find((f: any) => {
          if (!f.conditions) return true;
          if (f.conditions.trainingGroup && f.conditions.trainingGroup !== entry.group_id)
            return false;
          return true;
        }) ?? null;
      return {
        memberId: entry.member_id,
        memberName: '',
        groupId: entry.group_id,
        amount: fee?.amount ?? 0,
        feeConfigId: fee?.id ?? null,
        billingCycle: fee?.billing_cycle ?? 'season',
        installments: fee?.billing_cycle === 'installment' ? (fee.installment_count ?? 1) : 1,
      };
    });
    return NextResponse.json(preview);
  });
}
