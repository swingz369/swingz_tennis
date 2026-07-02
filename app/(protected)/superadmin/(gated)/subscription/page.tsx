import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { PLANS, recommendSchoolPlan, SCHOOL_THRESHOLD, type PlanKey } from '@/lib/plans';
import {
  PlanCards,
  SubscriptionToasts,
} from '@/app/(protected)/admin/(gated)/subscription/subscribe-button';
import { Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const FEATURES = [
  'Verwaltung aller Vereine',
  'Mitgliederverwaltung',
  'Buchungs-Management',
  'Trainer & Saisonplanung',
  'Finanzen & Rechnungen',
  'Alle Features inkludiert',
];

export default async function SuperadminSubscriptionPage() {
  const { user } = await requireAuth();
  const sb = createServiceClient();

  const [{ data: profile }, { count: clubCount }] = await Promise.all([
    sb.from('users').select('subscription_tier, subscription_status').eq('id', user.id).single(),
    sb
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'superadmin')
      .eq('is_active', true),
  ]);

  const tier = profile?.subscription_tier ?? 'free';
  const status = profile?.subscription_status ?? 'inactive';
  const count = clubCount ?? 0;
  const recommended = recommendSchoolPlan(count);
  const isActive = status === 'active' && (tier === 'school_s' || tier === 'school_l');
  const planKeys: PlanKey[] = ['school_s', 'school_l'];

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      <Suspense fallback={null}>
        <SubscriptionToasts />
      </Suspense>

      <div>
        <h1 className="text-2xl font-bold">Abonnement Tennisschule</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gleicher Funktionsumfang in beiden Plänen — der Preis richtet sich nur nach der Anzahl
          deiner Vereine.
        </p>
      </div>

      <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-4 py-3 text-sm">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          Deine Vereine:{' '}
          <strong className="text-foreground">
            {count} / {SCHOOL_THRESHOLD}
          </strong>{' '}
          · Empfohlen: <strong className="text-foreground">{PLANS[recommended].label}</strong>
        </span>
      </div>

      <PlanCards
        planKeys={planKeys}
        recommended={recommended}
        currentTier={tier}
        isActive={isActive}
        features={FEATURES}
      />

      <p className="text-center text-xs text-muted-foreground">
        Jederzeit kündbar · SSL-verschlüsselt · DSGVO-konform
      </p>
    </div>
  );
}
