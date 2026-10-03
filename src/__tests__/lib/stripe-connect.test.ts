import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/stripe/stripe-client', () => ({ stripe: vi.fn() }));
vi.mock('@/infrastructure/db', () => ({ getUserDb: vi.fn(), systemDb: vi.fn() }));

import { platformFeeCents } from '@/lib/plans';
import { signMetadata, hasValidSignature } from '@/application/services/stripe-connect.service';

describe('platformFeeCents (0,5 %)', () => {
  it('rechnet und rundet auf ganze Cent', () => {
    expect(platformFeeCents(10_000)).toBe(50);
    expect(platformFeeCents(1_999)).toBe(10);
    expect(platformFeeCents(99)).toBe(0);
  });
});

describe('Checkout-Metadaten-Signatur', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_signatur';
  });

  it('akzeptiert von uns signierte Metadaten', () => {
    expect(hasValidSignature(signMetadata({ invoiceId: 'inv-1', clubId: 'club-a' }))).toBe(true);
  });

  it('lehnt veränderte, fehlende oder fremde Signaturen ab', () => {
    const signed = signMetadata({ invoiceId: 'inv-1', clubId: 'club-a' });
    expect(hasValidSignature({ ...signed, invoiceId: 'inv-2' })).toBe(false);
    expect(hasValidSignature({ invoiceId: 'inv-1', clubId: 'club-a' })).toBe(false);
    expect(hasValidSignature({ ...signed, sig: 'abc' })).toBe(false);
    expect(hasValidSignature(null)).toBe(false);
  });
});
