import { describe, it, expect } from 'vitest';
import { mergeFamilyMemberPreviews, type FamilyMember } from '@/lib/billing/family-invoice-merge';
import type { MemberBillingPreview } from '@/lib/types/billing.types';

function preview(
  overrides: Partial<MemberBillingPreview> & { memberId: string; memberName: string }
): MemberBillingPreview {
  const trainingCost = overrides.trainingCost ?? 75;
  const tax = overrides.taxAmount ?? 0;
  return {
    groupName: 'Gruppe A',
    trainingCost,
    membershipFee: 0,
    additionalFees: 0,
    subtotalAmount: trainingCost,
    taxAmount: tax,
    totalAmount: trainingCost + tax,
    lineItems: [
      {
        description: 'Training Gruppe A (Sommer 2026)',
        quantity: 1,
        unitPrice: trainingCost,
        taxRate: 0,
        totalPrice: trainingCost,
        taxPrice: tax,
        itemType: 'training_fee',
      },
    ],
    ...overrides,
  };
}

const ADULT: FamilyMember = {
  memberId: 'adult',
  name: 'Erika Eltern',
  relationship: 'primary',
  dateOfBirth: '1985-01-01',
};

const CHILD_A: FamilyMember = {
  memberId: 'child-a',
  name: 'Max Mustermann',
  relationship: 'family',
  dateOfBirth: '2015-01-01',
};

const CHILD_B: FamilyMember = {
  memberId: 'child-b',
  name: 'Mia Mustermann',
  relationship: 'family',
  dateOfBirth: '2017-01-01',
};

describe('mergeFamilyMemberPreviews', () => {
  it('leaves previews untouched when there is no family roster', () => {
    const p = preview({ memberId: 'solo', memberName: 'Solo' });
    const result = mergeFamilyMemberPreviews([p], new Map());
    expect(result.previews).toEqual([p]);
    expect(result.memberCount).toBe(1);
  });

  it('folds a family (billable adult + children) into one invoice on the adult', () => {
    const adult = preview({ memberId: 'adult', memberName: 'Erika Eltern', trainingCost: 100 });
    const a = preview({ memberId: 'child-a', memberName: 'Max Mustermann', trainingCost: 75 });
    const b = preview({ memberId: 'child-b', memberName: 'Mia Mustermann', trainingCost: 50 });

    const roster = new Map([['grp-1', [ADULT, CHILD_A, CHILD_B]]]);
    const result = mergeFamilyMemberPreviews([adult, a, b], roster);

    expect(result.memberCount).toBe(3);
    expect(result.previews).toHaveLength(1);

    const invoice = result.previews[0];
    expect(invoice.memberId).toBe('adult');
    expect(invoice.memberName).toBe('Erika Eltern');
    expect(invoice.totalAmount).toBeCloseTo(225);
    expect(invoice.lineItems).toHaveLength(3);
    // Children's items are prefixed with their names; the adult's own is not.
    expect(invoice.lineItems.map((i) => i.description)).toEqual([
      'Erika Eltern: Training Gruppe A (Sommer 2026)',
      'Max Mustermann: Training Gruppe A (Sommer 2026)',
      'Mia Mustermann: Training Gruppe A (Sommer 2026)',
    ]);
    expect(invoice.collectiveMembers).toEqual(['Erika Eltern', 'Max Mustermann', 'Mia Mustermann']);
  });

  it('addresses a lone billable child to the (non-billable) adult', () => {
    const child = preview({ memberId: 'child-a', memberName: 'Max Mustermann', trainingCost: 60 });
    const roster = new Map([['grp-1', [ADULT, CHILD_A]]]);
    const result = mergeFamilyMemberPreviews([child], roster);

    expect(result.memberCount).toBe(1);
    expect(result.previews).toHaveLength(1);
    const invoice = result.previews[0];
    expect(invoice.memberId).toBe('adult');
    expect(invoice.memberName).toBe('Erika Eltern');
    expect(invoice.totalAmount).toBeCloseTo(60);
    expect(invoice.lineItems[0].description).toBe(
      'Max Mustermann: Training Gruppe A (Sommer 2026)'
    );
    expect(invoice.collectiveMembers).toEqual(['Erika Eltern', 'Max Mustermann']);
  });

  it('bills each member individually when the group has no adult', () => {
    const a = preview({ memberId: 'child-a', memberName: 'Max Mustermann' });
    const b = preview({ memberId: 'child-b', memberName: 'Mia Mustermann' });
    const roster = new Map([['grp-1', [CHILD_A, CHILD_B]]]);
    const result = mergeFamilyMemberPreviews([a, b], roster);

    expect(result.previews).toHaveLength(2);
    expect(result.previews.map((p) => p.memberId).sort()).toEqual(['child-a', 'child-b']);
  });

  it('keeps non-family members separate from family invoices', () => {
    const adult = preview({ memberId: 'adult', memberName: 'Erika Eltern' });
    const child = preview({ memberId: 'child-a', memberName: 'Max Mustermann' });
    const outsider = preview({ memberId: 'outsider', memberName: 'Otto Ohne' });

    const roster = new Map([['grp-1', [ADULT, CHILD_A]]]);
    const result = mergeFamilyMemberPreviews([adult, child, outsider], roster);

    expect(result.previews).toHaveLength(2);
    expect(result.previews.map((p) => p.memberId).sort()).toEqual(['adult', 'outsider']);
    expect(result.memberCount).toBe(3);
  });

  it('leaves a billable adult with no billable family members as a single invoice', () => {
    const adult = preview({ memberId: 'adult', memberName: 'Erika Eltern' });
    const roster = new Map([['grp-1', [ADULT, CHILD_A]]]); // child has no charges
    const result = mergeFamilyMemberPreviews([adult], roster);

    expect(result.previews).toHaveLength(1);
    expect(result.previews[0]).toEqual(adult);
    expect(result.previews[0].collectiveMembers).toBeUndefined();
  });
});
