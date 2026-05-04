import { createClient } from '@supabase/supabase-js';
import type { MemberBillingSummary, ClubBillingStats } from '../types/billing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class StatsService {
  private static instance: StatsService;

  private constructor() {}

  public static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }

  async getMemberBillingSummary(memberId: string): Promise<MemberBillingSummary> {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('total_amount, paid_amount, status')
      .eq('member_id', memberId);

    if (error) {
      throw new Error(`Failed to get member invoices: ${error.message}`);
    }

    const totalInvoices = invoices?.length || 0;
    const totalAmount = invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
    const paidAmount = invoices?.reduce((sum, inv) => sum + inv.paid_amount, 0) || 0;
    const outstandingAmount = totalAmount - paidAmount;
    const overdueInvoices =
      invoices?.filter((inv) => inv.status === 'overdue' || inv.status === 'dunning').length || 0;

    const { count: activeMandates } = await supabase
      .from('sepa_mandates')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('status', 'active');

    return {
      member_id: memberId,
      total_invoices: totalInvoices,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      overdue_invoices: overdueInvoices,
      active_mandates: activeMandates || 0,
    };
  }

  async getClubBillingStats(clubId: string): Promise<ClubBillingStats> {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('total_amount, paid_amount, status')
      .eq('club_id', clubId);

    if (error) {
      throw new Error(`Failed to get club invoices: ${error.message}`);
    }

    const totalInvoices = invoices?.length || 0;
    const totalRevenue = invoices?.reduce((sum, inv) => sum + inv.paid_amount, 0) || 0;
    const totalAmount = invoices?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
    const outstandingAmount = totalAmount - totalRevenue;
    const overdueAmount =
      invoices
        ?.filter((inv) => inv.status === 'overdue' || inv.status === 'dunning')
        .reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0) || 0;

    const { data: payments } = await supabase
      .from('payments')
      .select('payment_method')
      .eq('club_id', clubId)
      .eq('status', 'completed');

    const paymentMethods: Record<string, number> = {};
    payments?.forEach((p) => {
      paymentMethods[p.payment_method] = (paymentMethods[p.payment_method] || 0) + 1;
    });

    const { data: dunningRecords } = await supabase
      .from('dunning_records')
      .select('dunning_level')
      .eq('club_id', clubId)
      .eq('status', 'sent');

    const dunningLevel1 = dunningRecords?.filter((d) => d.dunning_level === 1).length || 0;
    const dunningLevel2 = dunningRecords?.filter((d) => d.dunning_level === 2).length || 0;
    const dunningLevel3 = dunningRecords?.filter((d) => d.dunning_level === 3).length || 0;

    return {
      club_id: clubId,
      total_invoices: totalInvoices,
      total_revenue: totalRevenue,
      paid_amount: totalRevenue,
      outstanding_amount: outstandingAmount,
      overdue_amount: overdueAmount,
      payment_methods: paymentMethods,
      dunning_level_1: dunningLevel1,
      dunning_level_2: dunningLevel2,
      dunning_level_3: dunningLevel3,
    };
  }
}

export const statsService = StatsService.getInstance();
