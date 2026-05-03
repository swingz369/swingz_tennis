import {
  BillingPeriod,
  TrainerBilling,
  BillingLineItem,
  CreateTrainerBillingInput,
  UpdateTrainerBillingInput,
  BillingSummary,
} from '../entities/billing.entity';

export class BillingService {
  private static billingPeriods: BillingPeriod[] = [];
  private static trainerBillings: TrainerBilling[] = [];
  private static billingLineItems: BillingLineItem[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `billing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new billing period
   */
  static async createBillingPeriod(startDate: string, endDate: string): Promise<BillingPeriod> {
    const now = new Date().toISOString();
    const billingPeriod: BillingPeriod = {
      id: this.generateId(),
      startDate,
      endDate,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    this.billingPeriods.push(billingPeriod);
    return billingPeriod;
  }

  /**
   * Get billing period by ID
   */
  static async getBillingPeriodById(id: string): Promise<BillingPeriod | null> {
    return this.billingPeriods.find((p) => p.id === id) || null;
  }

  /**
   * Get all billing periods
   */
  static async getAllBillingPeriods(): Promise<BillingPeriod[]> {
    return [...this.billingPeriods];
  }

  /**
   * Get current billing period
   */
  static async getCurrentBillingPeriod(): Promise<BillingPeriod | null> {
    const now = new Date();
    return (
      this.billingPeriods.find(
        (p) =>
          p.status === 'open' &&
          new Date(p.startDate) <= now &&
          new Date(p.endDate) >= now
      ) || null
    );
  }

  /**
   * Close billing period
   */
  static async closeBillingPeriod(id: string): Promise<BillingPeriod | null> {
    const index = this.billingPeriods.findIndex((p) => p.id === id);
    if (index === -1) {
      return null;
    }

    this.billingPeriods[index].status = 'closed';
    this.billingPeriods[index].updatedAt = new Date().toISOString();

    return this.billingPeriods[index];
  }

  /**
   * Create trainer billing
   */
  static async createTrainerBilling(input: CreateTrainerBillingInput): Promise<TrainerBilling> {
    const now = new Date().toISOString();
    const trainerBilling: TrainerBilling = {
      id: this.generateId(),
      billingPeriodId: input.billingPeriodId,
      trainerId: input.trainerId,
      trainerName: input.trainerName,
      totalHours: input.totalHours,
      hourlyRate: input.hourlyRate,
      totalAmount: input.totalAmount,
      status: 'pending',
      dueDate: input.dueDate,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.trainerBillings.push(trainerBilling);
    return trainerBilling;
  }

  /**
   * Get trainer billing by ID
   */
  static async getTrainerBillingById(id: string): Promise<TrainerBilling | null> {
    return this.trainerBillings.find((b) => b.id === id) || null;
  }

  /**
   * Get trainer billings by billing period
   */
  static async getTrainerBillingsByBillingPeriod(billingPeriodId: string): Promise<TrainerBilling[]> {
    return this.trainerBillings.filter((b) => b.billingPeriodId === billingPeriodId);
  }

  /**
   * Get trainer billings by trainer ID
   */
  static async getTrainerBillingsByTrainerId(trainerId: string): Promise<TrainerBilling[]> {
    return this.trainerBillings.filter((b) => b.trainerId === trainerId);
  }

  /**
   * Get all trainer billings
   */
  static async getAllTrainerBillings(): Promise<TrainerBilling[]> {
    return [...this.trainerBillings];
  }

  /**
   * Update trainer billing
   */
  static async updateTrainerBilling(id: string, input: UpdateTrainerBillingInput): Promise<TrainerBilling | null> {
    const index = this.trainerBillings.findIndex((b) => b.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.trainerBillings[index];
    const updated: TrainerBilling = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.trainerBillings[index] = updated;
    return updated;
  }

  /**
   * Mark trainer billing as paid
   */
  static async markTrainerBillingAsPaid(id: string): Promise<TrainerBilling | null> {
    return this.updateTrainerBilling(id, {
      status: 'paid',
      paidAt: new Date().toISOString(),
    });
  }

  /**
   * Mark trainer billing as overdue
   */
  static async markTrainerBillingAsOverdue(id: string): Promise<TrainerBilling | null> {
    return this.updateTrainerBilling(id, {
      status: 'overdue',
    });
  }

  /**
   * Create billing line item
   */
  static async createBillingLineItem(
    trainerBillingId: string,
    date: string,
    description: string,
    hours: number,
    rate: number,
    type: 'training' | 'preparation' | 'meeting' | 'other',
    sessionId?: string
  ): Promise<BillingLineItem> {
    const now = new Date().toISOString();
    const billingLineItem: BillingLineItem = {
      id: this.generateId(),
      trainerBillingId,
      date,
      description,
      hours,
      rate,
      amount: hours * rate,
      type,
      sessionId,
    };

    this.billingLineItems.push(billingLineItem);
    return billingLineItem;
  }

  /**
   * Get billing line items by trainer billing ID
   */
  static async getBillingLineItemsByTrainerBilling(trainerBillingId: string): Promise<BillingLineItem[]> {
    return this.billingLineItems.filter((i) => i.trainerBillingId === trainerBillingId);
  }

  /**
   * Get all billing line items
   */
  static async getAllBillingLineItems(): Promise<BillingLineItem[]> {
    return [...this.billingLineItems];
  }

  /**
   * Calculate billing summary for a billing period
   */
  static async calculateBillingSummary(billingPeriodId: string): Promise<BillingSummary> {
    const periodBillings = this.trainerBillings.filter((b) => b.billingPeriodId === billingPeriodId);

    const totalTrainers = periodBillings.length;
    const totalHours = periodBillings.reduce((sum, b) => sum + b.totalHours, 0);
    const totalAmount = periodBillings.reduce((sum, b) => sum + b.totalAmount, 0);
    const pendingAmount = periodBillings.filter((b) => b.status === 'pending').reduce((sum, b) => sum + b.totalAmount, 0);
    const processedAmount = periodBillings.filter((b) => b.status === 'processed').reduce((sum, b) => sum + b.totalAmount, 0);
    const paidAmount = periodBillings.filter((b) => b.status === 'paid').reduce((sum, b) => sum + b.totalAmount, 0);
    const overdueAmount = periodBillings.filter((b) => b.status === 'overdue').reduce((sum, b) => sum + b.totalAmount, 0);

    return {
      billingPeriodId,
      totalTrainers,
      totalHours,
      totalAmount,
      pendingAmount,
      processedAmount,
      paidAmount,
      overdueAmount,
    };
  }

  /**
   * Generate invoice number
   */
  static generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = this.trainerBillings.filter((b) => b.invoiceNumber?.startsWith(`INV-${year}${month}`)).length + 1;
    return `INV-${year}${month}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    this.billingPeriods = [
      {
        id: 'period-current',
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        status: 'open',
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'period-last',
        startDate: lastMonthStart,
        endDate: lastMonthEnd,
        status: 'closed',
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    this.trainerBillings = [
      {
        id: 'billing-1',
        billingPeriodId: 'period-last',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        totalHours: 45,
        hourlyRate: 50,
        totalAmount: 2250,
        status: 'paid',
        invoiceNumber: 'INV-202504-0001',
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paidAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'billing-2',
        billingPeriodId: 'period-last',
        trainerId: 'trainer-2',
        trainerName: 'Julia Weber',
        totalHours: 38,
        hourlyRate: 55,
        totalAmount: 2090,
        status: 'paid',
        invoiceNumber: 'INV-202504-0002',
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paidAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'billing-3',
        billingPeriodId: 'period-current',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        totalHours: 32,
        hourlyRate: 50,
        totalAmount: 1600,
        status: 'pending',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'billing-4',
        billingPeriodId: 'period-current',
        trainerId: 'trainer-2',
        trainerName: 'Julia Weber',
        totalHours: 28,
        hourlyRate: 55,
        totalAmount: 1540,
        status: 'pending',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    this.billingLineItems = [
      {
        id: 'line-1',
        trainerBillingId: 'billing-1',
        date: '2025-04-01',
        description: 'Training Session 1',
        hours: 2,
        rate: 50,
        amount: 100,
        type: 'training',
        sessionId: 'session-1',
      },
      {
        id: 'line-2',
        trainerBillingId: 'billing-1',
        date: '2025-04-02',
        description: 'Training Session 2',
        hours: 1.5,
        rate: 50,
        amount: 75,
        type: 'training',
        sessionId: 'session-2',
      },
      {
        id: 'line-3',
        trainerBillingId: 'billing-2',
        date: '2025-04-01',
        description: 'Training Session 3',
        hours: 2,
        rate: 55,
        amount: 110,
        type: 'training',
        sessionId: 'session-3',
      },
    ];
  }
}

// Initialize mock data
BillingService.initializeMockData();
