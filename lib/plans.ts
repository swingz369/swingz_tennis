export type PlanKey = 'solo_s' | 'solo_l' | 'school_s' | 'school_l';
export type BillingInterval = 'monthly' | 'annual';

export const BILLING_INTERVALS: Record<BillingInterval, { label: string; monthCount: number }> = {
  monthly: { label: 'Monatlich', monthCount: 1 },
  annual: { label: 'Jährlich', monthCount: 12 },
};

// Preise/Schwellen müssen mit app/(marketing)/landing/_components/pricing-section.tsx übereinstimmen.
export const PLANS: Record<
  PlanKey,
  {
    label: string;
    sublabel: string;
    pricePerMonth: number;
    priceEnvKey: string;
    type: 'solo' | 'school';
  }
> = {
  solo_s: {
    label: 'Starter',
    sublabel: 'bis 200 Mitglieder',
    pricePerMonth: 29,
    priceEnvKey: 'STRIPE_PRICE_SOLO_S',
    type: 'solo',
  },
  solo_l: {
    label: 'Professional',
    sublabel: 'ab 201 Mitglieder',
    pricePerMonth: 49,
    priceEnvKey: 'STRIPE_PRICE_SOLO_L',
    type: 'solo',
  },
  school_s: {
    label: 'Tennisschule S',
    sublabel: 'bis zu 5 Vereine',
    pricePerMonth: 79,
    priceEnvKey: 'STRIPE_PRICE_SCHOOL_S',
    type: 'school',
  },
  school_l: {
    label: 'Tennisschule L',
    sublabel: 'mehr als 5 Vereine',
    pricePerMonth: 99,
    priceEnvKey: 'STRIPE_PRICE_SCHOOL_L',
    type: 'school',
  },
};

export const SOLO_THRESHOLD = 200; // Mitglieder
export const SCHOOL_THRESHOLD = 5; // Vereine

export function recommendSoloPlan(memberCount: number): PlanKey {
  return memberCount > SOLO_THRESHOLD ? 'solo_l' : 'solo_s';
}

export function recommendSchoolPlan(clubCount: number): PlanKey {
  return clubCount > SCHOOL_THRESHOLD ? 'school_l' : 'school_s';
}

export function getPriceId(
  plan: PlanKey,
  interval: BillingInterval = 'monthly'
): string | undefined {
  const suffix: Record<BillingInterval, string> = { monthly: '', annual: '_Y' };
  const key = PLANS[plan].priceEnvKey + suffix[interval];
  if (interval !== 'monthly') return process.env[key];
  // monthly: try new key, then legacy
  const legacy: Partial<Record<PlanKey, string | undefined>> = {
    solo_s: process.env.STRIPE_STARTER_PRICE_ID,
    solo_l: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
  };
  return process.env[key] ?? legacy[plan];
}

// Display labels incl. legacy + free
export const PLAN_LABELS: Record<string, string> = {
  free: 'Kein Abonnement',
  solo_s: 'Starter',
  solo_l: 'Professional',
  school_s: 'Tennisschule S',
  school_l: 'Tennisschule L',
  starter: 'Starter',
  professional: 'Professional',
};
