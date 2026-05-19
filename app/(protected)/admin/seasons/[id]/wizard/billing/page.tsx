import { notFound } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { BillingPreviewTable } from './billing-preview-table';

type PreviewItem = {
  memberId: string;
  memberName: string;
  groupId: string;
  amount: number;
  feeConfigId: string | null;
  billingCycle: string;
  installments: number;
};

export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: season } = await (supabase as any)
    .from('seasons')
    .select('id, club_id, name')
    .eq('id', id)
    .single();
  if (!season) notFound();

  const [{ data: entries }, { data: feeConfigs }] = await Promise.all([
    (supabase as any).from('season_plan_entries').select('member_id, group_id').eq('season_id', id),
    (supabase as any)
      .from('fee_configurations')
      .select('*')
      .eq('club_id', season.club_id)
      .eq('is_active', true),
  ]);

  const preview: PreviewItem[] = ((entries as any[]) ?? []).map((entry: any) => {
    const fee =
      ((feeConfigs as any[]) ?? []).find((f: any) => {
        if (!f.conditions) return true;
        if (f.conditions.trainingGroup && f.conditions.trainingGroup !== entry.group_id)
          return false;
        return true;
      }) ?? null;
    return {
      memberId: entry.member_id,
      memberName: entry.member_id,
      groupId: entry.group_id,
      amount: fee?.amount ?? 0,
      feeConfigId: fee?.id ?? null,
      billingCycle: fee?.billing_cycle ?? 'season',
      installments: fee?.billing_cycle === 'installment' ? (fee.installment_count ?? 1) : 1,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Rechnungsvorschau prüfen und Rechnungen generieren.</p>
      </div>
      <BillingPreviewTable seasonId={id} preview={preview} />
    </div>
  );
}
