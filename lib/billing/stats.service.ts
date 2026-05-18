import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { MemberBillingSummary, ClubBillingStats } from '../types/billing';

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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
      .select('id, amount, status')
      .eq('member_id', memberId);

    if (error) {
      throw new Error(`Failed to get member invoices: ${error.message}`);
    }

    const totalInvoices = invoices?.length || 0;
    const totalAmount = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

    // paid_amount from payments via invoice join
    const invoiceIds = invoices?.map((inv) => inv.id) || [];
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, invoice_id')
      .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'completed');

    const paidAmount = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const outstandingAmount = totalAmount - paidAmount;
    const overdueInvoices =
      invoices?.filter((inv) => inv.status === 'overdue').length || 0;

    const { count: activeMandates } = await supabase
      .from('sepa_mandates')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('is_active', true);

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
      .select('id, amount, status')
      .eq('club_id', clubId);

    if (error) {
      throw new Error(`Failed to get club invoices: ${error.message}`);
    }

    const totalInvoices = invoices?.length || 0;
    const totalAmount = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
    const overdueAmount =
      invoices
        ?.filter((inv) => inv.status === 'overdue')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

    // Payments: join via invoice_id
    const invoiceIds = invoices?.map((inv) => inv.id) || [];
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, payment_method')
      .in('invoice_id', invoiceIds)
      .eq('status', 'completed');

    const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const outstandingAmount = totalAmount - totalRevenue;

    const paymentMethods: Record<string, number> = {};
    payments?.forEach((p) => {
      if (p.payment_method) {
        paymentMethods[p.payment_method] = (paymentMethods[p.payment_method] || 0) + 1;
      }
    });

    // Dunning records: join via invoice_id
    const { data: dunningRecords } = await supabase
      .from('dunning_records')
      .select('level')
      .in('invoice_id', invoiceIds);

    const dunningLevel1 = dunningRecords?.filter((d) => d.level === 1).length || 0;
    const dunningLevel2 = dunningRecords?.filter((d) => d.level === 2).length || 0;
    const dunningLevel3 = dunningRecords?.filter((d) => d.level === 3).length || 0;

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
