import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import Link from 'next/link';
import {
  Building2,
  ChevronRight,
  Shield,
  UserCog,
  Plus,
  Inbox,
  AlertTriangle,
  ScrollText,
  CircleSlash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiBand } from '@/components/ui/kpi-band';
import { PageHeader } from '@/components/ui/page-header';
import { monthlyRecurringRevenue } from '@/lib/billing-plans';
import { auditActionLabel } from '@/lib/audit-labels';

export const dynamic = 'force-dynamic';

/**
 * /owner — Plattform-Konsole.
 *
 * Aufbau analog zum Admin-Dashboard (KPI-Band → Handlungsbedarf → Liste →
 * Schnellaktionen), aber mit den Kennzahlen, die ein Plattformbetreiber
 * tatsächlich steuert. Vorher standen hier vier Bestandszahlen (Vereine,
 * Nutzer, Superadmins, Admins) — richtig, aber ohne Handlungsbezug: keine
 * davon sagt, was heute zu tun ist oder was die Plattform verdient.
 *
 * Deshalb jetzt:
 *   • MRR statt „Nutzer gesamt" — die Zahl, an der ein SaaS hängt.
 *   • Aktive Vereine mit Gesamtzahl als Kontext (vorher zählte `clubs` auch
 *     gelöschte und inaktive mit).
 *   • Ein Block „Braucht Aufmerksamkeit": offene Zugangsanfragen, Vereine ohne
 *     aktiven Admin, Vereine ohne abgeschlossenes Setup. Das sind die drei
 *     Zustände, in denen ein Verein ohne Zutun des Betreibers stecken bleibt —
 *     sie waren bisher nur zu finden, wenn man zufällig die richtige Seite
 *     aufrief.
 *   • Letzte Plattform-Aktivität aus dem Audit-Log.
 */
export default async function OwnerPage() {
  const { user } = await requireAuth();
  // Service client bypasses RLS — needed for platform-wide stats before owner RLS policies are applied
  const sb = createServiceClient();

  const [
    { data: clubs },
    { data: memberships },
    { data: subscribers },
    { count: pendingRequests },
    { data: recentAudit },
    { data: profile },
  ] = await Promise.all([
    sb
      .from('clubs')
      .select('id, name, status, created_at, setup_completed_at, deleted_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    sb.from('user_club_memberships').select('club_id, role, is_active').eq('is_active', true),
    sb
      .from('users')
      .select('subscription_tier, subscription_status')
      .not('subscription_tier', 'is', null),
    sb
      .from('club_access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    sb
      .from('audit_logs')
      .select('id, action, resource_type, created_at, club_id, actor:actor_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(5),
    sb.from('users').select('full_name').eq('id', user.id).maybeSingle(),
  ]);

  const firstName = profile?.full_name?.split(' ')[0] || 'Owner';
  const allClubs = clubs ?? [];
  const activeClubs = allClubs.filter((c: any) => c.status !== 'inactive');

  // Mitglieder- und Admin-Verteilung in einem Durchlauf statt einer Query je Verein.
  const membersByClub = new Map<string, number>();
  const adminsByClub = new Map<string, number>();
  for (const m of (memberships ?? []) as any[]) {
    if (!m.club_id) continue;
    membersByClub.set(m.club_id, (membersByClub.get(m.club_id) ?? 0) + 1);
    if (m.role === 'admin' || m.role === 'superadmin') {
      adminsByClub.set(m.club_id, (adminsByClub.get(m.club_id) ?? 0) + 1);
    }
  }

  const mrr = monthlyRecurringRevenue((subscribers ?? []) as any[]);
  const clubsWithoutAdmin = activeClubs.filter((c: any) => !adminsByClub.get(c.id));
  const clubsWithoutSetup = activeClubs.filter((c: any) => !c.setup_completed_at);
  const totalMembers = memberships?.length ?? 0;

  const attention = [
    {
      key: 'requests',
      count: pendingRequests ?? 0,
      label: 'Offene Zugangsanfragen',
      hint: 'warten auf Freigabe oder Absage',
      href: '/owner/access',
      icon: Inbox,
    },
    {
      key: 'no-admin',
      count: clubsWithoutAdmin.length,
      label: 'Vereine ohne Admin',
      hint: 'niemand kann den Verein verwalten',
      href: '/owner/clubs',
      icon: AlertTriangle,
    },
    {
      key: 'no-setup',
      count: clubsWithoutSetup.length,
      label: 'Einrichtung offen',
      hint: 'Onboarding nie abgeschlossen',
      href: '/owner/clubs',
      icon: CircleSlash,
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-6">
      {/*
        Bewusst KEIN redundanter "Owner"-Badge rechts: das violette
        Plattform-Konsole-Banner aus /owner/layout.tsx ist die sichtbare
        Rollen-Markierung und wird nicht doppelt ausgespielt. Andere
        Owner-Pages folgen demselben Pattern.
      */}
      <PageHeader
        title="Plattform-Übersicht"
        description={<>Hallo {firstName} — Swingz Plattform-Dashboard</>}
      />

      {/* KPI-Band statt vier Karten — gleiche Behandlung wie im
          Admin-Dashboard, damit beide Ebenen ihre Kennzahlen gleich lesen. */}
      <KpiBand
        items={[
          {
            label: 'Aktive Vereine',
            value: activeClubs.length.toLocaleString('de-DE'),
            sub: `von ${allClubs.length} angelegt`,
          },
          {
            label: 'Monatsumsatz',
            value: `${mrr.toLocaleString('de-DE')} €`,
            sub: 'aus aktiven Abos',
          },
          {
            label: 'Mitglieder',
            value: totalMembers.toLocaleString('de-DE'),
            sub: 'aktiv über alle Vereine',
          },
          {
            label: 'Offene Anfragen',
            value: (pendingRequests ?? 0).toLocaleString('de-DE'),
            sub: 'Zugang angefragt',
          },
        ]}
      />

      {/* ── Braucht Aufmerksamkeit ──
          Erscheint nur, wenn es wirklich etwas zu tun gibt. Ein Block, der
          immer dasteht und meistens „0" zeigt, wird nach einer Woche
          überlesen. */}
      {attention.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attention.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 p-3 transition-colors hover:border-warning-400 dark:border-warning-700/40 dark:bg-warning-900/20"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-100 dark:bg-warning-800/40">
                <item.icon className="h-4 w-4 text-warning-700 dark:text-warning-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-warning-900 dark:text-warning-100">
                  {item.count} {item.label}
                </p>
                <p className="text-xs text-warning-800/80 dark:text-warning-200/70">{item.hint}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-warning-700 dark:text-warning-300" />
            </Link>
          ))}
        </div>
      )}

      {/* Alle Vereine */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Vereine
            <div className="flex items-center gap-2">
              <Link href="/owner/clubs?new=1">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Verein anlegen
                </Button>
              </Link>
              <Link
                href="/owner/clubs"
                className="text-xs text-info-600 hover:underline font-normal flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border dark:divide-white/5">
            {allClubs.slice(0, 10).map((club: any) => (
              <div key={club.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{club.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(membersByClub.get(club.id) ?? 0).toLocaleString('de-DE')} Mitglieder
                    {!adminsByClub.get(club.id) && ' · kein Admin'}
                    {!club.setup_completed_at && ' · Einrichtung offen'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {club.status === 'inactive' && (
                    <Badge variant="secondary" className="text-xs">
                      Inaktiv
                    </Badge>
                  )}
                  <Link
                    href={`/api/admin/switch-club-redirect?clubId=${club.id}`}
                    className="text-xs text-info-600 hover:text-info-800 dark:text-info-400 hover:underline whitespace-nowrap"
                  >
                    Als Admin →
                  </Link>
                </div>
              </div>
            ))}
            {allClubs.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Noch keine Vereine angelegt.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Letzte Plattform-Aktivität ──
          Der Owner ist die einzige Rolle mit Sicht über alle Vereine; ohne
          diesen Auszug müsste er das Audit-Log aktiv aufsuchen, um zu sehen,
          dass überhaupt etwas passiert ist. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            Letzte Aktivität
            <Link
              href="/owner/audit"
              className="text-xs text-info-600 hover:underline font-normal flex items-center gap-1"
            >
              Audit-Log <ChevronRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border dark:divide-white/5">
            {((recentAudit ?? []) as any[]).map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-2.5">
                <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{auditActionLabel(entry.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor?.full_name ?? entry.actor?.email ?? 'System'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
            {((recentAudit ?? []) as any[]).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Noch keine Ereignisse aufgezeichnet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schnellaktionen */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Schnellaktionen
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            // „Alle Vereine" stand hier doppelt (Karte oben verlinkt bereits
            // dorthin) — ersetzt durch die Wege, die sonst nirgends beginnen.
            { label: 'Verein anlegen', href: '/owner/clubs?new=1', icon: Building2 },
            { label: 'Admin einladen', href: '/owner/admins', icon: UserCog },
            { label: 'Zugangsanfragen', href: '/owner/access', icon: Inbox },
            { label: 'Superadmins', href: '/owner/superadmins', icon: Shield },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl border border-border dark:border-white/10 hover:border-info-400/50 hover:shadow-sm transition-all bg-background dark:bg-card/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-50 dark:bg-info-900/20 shrink-0">
                <action.icon className="h-4 w-4 text-info-600 dark:text-info-400" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
