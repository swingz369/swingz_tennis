import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireAdminClub } from '@/lib/admin-context';
import { createServiceClient } from '@/lib/supabase/service';
import { PLANS, recommendSoloPlan, SOLO_THRESHOLD, type PlanKey } from '@/lib/plans';
import { PlanCards, SubscriptionToasts } from './subscribe-button';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

const FEATURES = [
  'Mitgliederverwaltung',
  'Buchungs-Management',
  'Trainer & Saisonplanung',
  'Finanzen & Rechnungen',
  'Alle Features inkludiert',
];

export default async function AdminSubscriptionPage() {
  const { user, clubId, isSuperadmin } = await requireAdminClub();

  // Vereine einer Tennisschule verwalten ihr Abo beim Superadmin, nicht pro Einzelverein.
  if (isSuperadmin) redirect('/superadmin/subscription');

  const sb = createServiceClient();

  const [{ data: profile }, { count: memberCount }] = await Promise.all([
    sb.from('users').select('subscription_tier, subscription_status').eq('id', user.id).single(),
    sb
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', true)
      .not('role', 'in', '(trainer,superadmin)'),
  ]);

  const tier = profile?.subscription_tier ?? 'free';
  const status = profile?.subscription_status ?? 'inactive';
  const count = memberCount ?? 0;
  const recommended = recommendSoloPlan(count);
  const isActive = status === 'active' && (tier === 'solo_s' || tier === 'solo_l');
  const planKeys: PlanKey[] = ['solo_s', 'solo_l'];

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      <Suspense fallback={null}>
        <SubscriptionToasts />
      </Suspense>

      <PageHeader
        title="Abonnement"
        description="Gleicher Funktionsumfang in beiden Plänen — der Preis richtet sich nur nach der Mitgliederanzahl."
        breadcrumbs={[{ label: 'Abonnement' }]}
      />

      <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          Aktive Mitglieder:{' '}
          <strong className="text-foreground">
            {count} / {SOLO_THRESHOLD}
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
