/**
 * Unit tests for billing calculation logic.
 *
 * Testet die echten pure Funktionen aus `@/lib/billing/billing-preview`
 * (Production-Code) — die früher im Test duplizierte Logik wurde dorthin
 * extrahiert. Konsolidierungs-Hinweis (2026-08-13): Die historische
 * `billing-preview`-Route wurde unter `app/api/seasons/[id]/billing-preview`
 * reimplementiert und nutzt `computeBillingPreview` mit dem
 * `feeConfigurationService` (Drizzle-Adapter) als Datenquelle.
 */
import { describe, it, expect } from 'vitest';
import {
  computeBillingPreview,
  computeInvoiceTotals,
  matchFeeConfiguration,
  roundCurrency,
} from '@/lib/billing/billing-preview';
import type {
  BillingPreviewEntry,
  BillingPreviewFeeConfig,
  InvoiceLineItem,
} from '@/lib/billing/billing-preview';

// ════════════════════════════════════════════════════════════
// Fee Config Matching
// ════════════════════════════════════════════════════════════

describe('computeBillingPreview', () => {
  const feeConfigs: BillingPreviewFeeConfig[] = [
    {
      id: 'fee-beginner',
      amount: 25.0,
      billing_cycle: 'monthly',
      conditions: { trainingGroup: ['group-beginner'] },
    },
    {
      id: 'fee-advanced',
      amount: 40.0,
      billing_cycle: 'season',
      conditions: { trainingGroup: ['group-advanced'] },
    },
    {
      id: 'fee-default',
      amount: 15.0,
      billing_cycle: 'season',
      conditions: null,
    },
    {
      id: 'fee-installment',
      amount: 120.0,
      billing_cycle: 'installment',
      installment_count: 4,
      conditions: { trainingGroup: ['group-installment'] },
    },
  ];

  it('matches entry to specific group-configured fee', () => {
    const entries: BillingPreviewEntry[] = [{ member_id: 'm1', group_id: 'group-beginner' }];

    const result = computeBillingPreview(entries, feeConfigs);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(25.0);
    expect(result[0].feeConfigId).toBe('fee-beginner');
    expect(result[0].billingCycle).toBe('monthly');
  });

  it('falls back to unconditional fee when group does not match', () => {
    const entries: BillingPreviewEntry[] = [{ member_id: 'm1', group_id: 'group-unknown' }];

    const result = computeBillingPreview(entries, feeConfigs);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(15.0);
    expect(result[0].feeConfigId).toBe('fee-default');
  });

  it('returns zero when no fee configs at all', () => {
    const entries: BillingPreviewEntry[] = [{ member_id: 'm1', group_id: 'group-beginner' }];

    const result = computeBillingPreview(entries, []);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(0);
    expect(result[0].feeConfigId).toBe(null);
    expect(result[0].billingCycle).toBe('season');
  });

  it('returns empty array for empty entries', () => {
    expect(computeBillingPreview([], feeConfigs)).toEqual([]);
  });

  it('handles multiple entries with different fee matches', () => {
    const entries: BillingPreviewEntry[] = [
      { member_id: 'm1', group_id: 'group-beginner' },
      { member_id: 'm2', group_id: 'group-advanced' },
      { member_id: 'm3', group_id: 'group-unknown' },
    ];

    const result = computeBillingPreview(entries, feeConfigs);

    expect(result).toHaveLength(3);
    expect(result[0].amount).toBe(25.0);
    expect(result[1].amount).toBe(40.0);
    expect(result[2].amount).toBe(15.0);
  });

  it('handles installment billing cycle with installment count', () => {
    // Must place fee-installment BEFORE any unconditional match (fee-default)
    // because the matcher returns the FIRST match.
    const configs: BillingPreviewFeeConfig[] = [
      {
        id: 'fee-installment',
        amount: 120.0,
        billing_cycle: 'installment',
        installment_count: 4,
        conditions: { trainingGroup: ['group-installment'] },
      },
      { id: 'fee-default', amount: 15, billing_cycle: 'season', conditions: null },
    ];

    const entries: BillingPreviewEntry[] = [{ member_id: 'm1', group_id: 'group-installment' }];

    const result = computeBillingPreview(entries, configs);

    expect(result[0].billingCycle).toBe('installment');
    expect(result[0].installments).toBe(4);
  });

  it('defaults to installments=1 for non-installment cycles', () => {
    const entries: BillingPreviewEntry[] = [{ member_id: 'm1', group_id: 'group-beginner' }];

    const result = computeBillingPreview(entries, feeConfigs);

    expect(result[0].billingCycle).toBe('monthly');
    expect(result[0].installments).toBe(1);
  });

  it('first matching fee config wins (not the best)', () => {
    const configs: BillingPreviewFeeConfig[] = [
      { id: 'fee-a', amount: 100, billing_cycle: 'season', conditions: null },
      { id: 'fee-b', amount: 50, billing_cycle: 'season', conditions: null },
    ];

    const result = computeBillingPreview([{ member_id: 'm1', group_id: 'g1' }], configs);

    // First unconditional match (fee-a) wins
    expect(result[0].feeConfigId).toBe('fee-a');
    expect(result[0].amount).toBe(100);
  });

  it('empty conditions object matches any group (no restriction)', () => {
    const configs: BillingPreviewFeeConfig[] = [
      { id: 'fee-open', amount: 99, billing_cycle: 'season', conditions: {} },
    ];

    const result = computeBillingPreview([{ member_id: 'm1', group_id: 'any-group' }], configs);

    expect(result[0].feeConfigId).toBe('fee-open');
    expect(result[0].amount).toBe(99);
  });
});

// ════════════════════════════════════════════════════════════
// matchFeeConfiguration (First-Match-Semantik)
// ════════════════════════════════════════════════════════════

describe('matchFeeConfiguration', () => {
  it('returns null for empty config list', () => {
    expect(matchFeeConfiguration([], 'g1')).toBeNull();
  });

  it('matches a config whose trainingGroup contains the group', () => {
    const configs: BillingPreviewFeeConfig[] = [
      { id: 'a', amount: 10, billing_cycle: 'season', conditions: { trainingGroup: ['g1', 'g2'] } },
      { id: 'b', amount: 20, billing_cycle: 'season', conditions: null },
    ];

    expect(matchFeeConfiguration(configs, 'g2')?.id).toBe('a');
  });

  it('prefers the first config with matching trainingGroup over a later unconditional one', () => {
    const configs: BillingPreviewFeeConfig[] = [
      {
        id: 'specific',
        amount: 50,
        billing_cycle: 'monthly',
        conditions: { trainingGroup: ['g1'] },
      },
      { id: 'fallback', amount: 10, billing_cycle: 'season', conditions: null },
    ];

    expect(matchFeeConfiguration(configs, 'g1')?.id).toBe('specific');
  });

  it('uses the unconditional config when no trainingGroup matches', () => {
    const configs: BillingPreviewFeeConfig[] = [
      {
        id: 'specific',
        amount: 50,
        billing_cycle: 'monthly',
        conditions: { trainingGroup: ['g1'] },
      },
      { id: 'fallback', amount: 10, billing_cycle: 'season', conditions: null },
    ];

    expect(matchFeeConfiguration(configs, 'g-other')?.id).toBe('fallback');
  });
});

// ════════════════════════════════════════════════════════════
// Invoice Totals Calculation
// ════════════════════════════════════════════════════════════

describe('computeInvoiceTotals', () => {
  it('calculates correct subtotal, tax, and total for single item', () => {
    const items: InvoiceLineItem[] = [
      { description: 'Mitgliedsbeitrag', quantity: 1, unit_price: 29.99, tax_rate: 19 },
    ];

    const result = computeInvoiceTotals(items);

    expect(result.subtotal).toBe(29.99);
    expect(result.taxAmount).toBeCloseTo(5.7, 1); // 29.99 * 0.19 = 5.6981
    expect(result.total).toBeCloseTo(35.69, 2);
  });

  it('calculates correct totals for multiple items', () => {
    const items: InvoiceLineItem[] = [
      { description: 'Item A', quantity: 2, unit_price: 10.0, tax_rate: 19 },
      { description: 'Item B', quantity: 3, unit_price: 20.0, tax_rate: 7 },
    ];

    const result = computeInvoiceTotals(items);
    // subtotal = 2*10 + 3*20 = 80
    // tax = 20*0.19 + 60*0.07 = 3.8 + 4.2 = 8.0
    // total = 88.0
    expect(result.subtotal).toBe(80.0);
    expect(result.taxAmount).toBe(8.0);
    expect(result.total).toBe(88.0);
  });

  it('handles zero tax rate', () => {
    const items: InvoiceLineItem[] = [
      { description: 'Tax-free', quantity: 1, unit_price: 100.0, tax_rate: 0 },
    ];

    const result = computeInvoiceTotals(items);

    expect(result.subtotal).toBe(100.0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(100.0);
  });

  it('handles fractional unit prices and quantities', () => {
    const items: InvoiceLineItem[] = [
      { description: 'Fractional', quantity: 1.5, unit_price: 9.99, tax_rate: 19 },
    ];

    const result = computeInvoiceTotals(items);

    // 1.5 * 9.99 = 14.985 → rounded 14.99
    // tax = 14.985 * 0.19 = 2.84715 → rounded 2.85
    // total = 14.985 + 2.84715 = 17.83215 → rounded 17.83
    expect(result.subtotal).toBe(14.99);
    expect(result.taxAmount).toBeCloseTo(2.85, 1);
    expect(result.total).toBeCloseTo(17.83, 2);
  });

  it('returns zero totals for empty items array', () => {
    const result = computeInvoiceTotals([]);

    expect(result.subtotal).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles high-value items without floating-point overflow', () => {
    const items: InvoiceLineItem[] = [
      { description: 'Expensive', quantity: 1000, unit_price: 9999.99, tax_rate: 19 },
    ];

    const result = computeInvoiceTotals(items);

    expect(result.subtotal).toBe(9999990.0);
    expect(result.taxAmount).toBeCloseTo(1899998.1, 1);
    expect(result.total).toBeCloseTo(11899988.1, 1);
  });

  it('invoice item with quantity 0 adds no cost', () => {
    const items: InvoiceLineItem[] = [
      { description: 'Free item', quantity: 0, unit_price: 100.0, tax_rate: 19 },
    ];

    const result = computeInvoiceTotals(items);

    expect(result.subtotal).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════
// roundCurrency
// ════════════════════════════════════════════════════════════

describe('roundCurrency', () => {
  it('rounds to two decimals', () => {
    expect(roundCurrency(14.985)).toBe(14.99);
    expect(roundCurrency(14.984)).toBe(14.98);
  });

  it('rounds up on the half-cent boundary', () => {
    expect(roundCurrency(10.005)).toBe(10.01);
  });

  it('passes through exact values unchanged', () => {
    expect(roundCurrency(0)).toBe(0);
    expect(roundCurrency(88.0)).toBe(88);
    expect(roundCurrency(-1.234)).toBe(-1.23);
  });
});
