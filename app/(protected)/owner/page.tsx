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
  CircleSlash,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { KpiBand } from '@/components/ui/kpi-band';
import { PageHeader } from '@/components/ui/page-header';
import { monthlyRecurringRevenue } from '@/lib/billing-plans';
import { auditActionLabel, auditSubject } from '@/lib/audit-labels';

export const dynamic = 'force-dynamic';

// Zeilenmasse der Dashboard-Tabellen — identisch zum Admin-Dashboard, damit
// beide Ebenen gleich dicht wirken. Die geteilten Table-Bausteine bringen
// `p-4`/`h-10` mit; das ist für eine Übersichtskarte zu luftig.
const HEAD_CELL = 'h-auto px-5 pb-2.5 pt-0 text-2xs uppercase tracking-[0.09em]';
const BODY_CELL = 'px-5 py-2.5';

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
    sb
      .from('user_club_memberships')
      .select('user_id, club_id, role, is_active')
      .eq('is_active', true),
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
      .select(
        'id, action, resource_type, details, created_at, club_id, actor:actor_id(full_name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(5),
    sb.from('users').select('full_name').eq('id', user.id).maybeSingle(),
  ]);

  const firstName = profile?.full_name?.split(' ')[0] || 'Owner';
  const allClubs = clubs ?? [];
  const activeClubs = allClubs.filter((c: any) => c.status !== 'inactive');

  // Mitglieder- und Admin-Verteilung in einem Durchlauf statt einer Query je Verein.
  //
  // „Mitglieder" heißt hier Rolle `member` — nicht „Zeilen in
  // user_club_memberships". Vorher zählte die Kennzahl jede Mitgliedschaft mit:
  // Trainer, Admins und Superadmins waren als Mitglieder mitgezählt, und wer in
  // drei Vereinen aktiv ist, zählte dreifach. Die Zahl war damit zuverlässig zu
  // hoch und ließ sich mit keiner Zahl im Admin-Dashboard vergleichen.
  const membersByClub = new Map<string, number>();
  const adminsByClub = new Map<string, number>();
  const memberUserIds = new Set<string>();
  for (const m of (memberships ?? []) as any[]) {
    if (!m.club_id) continue;
    if (m.role === 'member') {
      membersByClub.set(m.club_id, (membersByClub.get(m.club_id) ?? 0) + 1);
      if (m.user_id) memberUserIds.add(m.user_id);
    }
    if (m.role === 'admin' || m.role === 'superadmin') {
      adminsByClub.set(m.club_id, (adminsByClub.get(m.club_id) ?? 0) + 1);
    }
  }

  const mrr = monthlyRecurringRevenue((subscribers ?? []) as any[]);
  const clubsWithoutAdmin = activeClubs.filter((c: any) => !adminsByClub.get(c.id));
  const clubsWithoutSetup = activeClubs.filter((c: any) => !c.setup_completed_at);
  // Personen, nicht Mitgliedschaften — sonst zählt ein Mitglied in zwei
  // Vereinen doppelt, und die Plattform-Kennzahl wächst ohne neue Kunden.
  const totalMembers = memberUserIds.size;

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
        description={<>Hallo {firstName} | Swingz Plattform-Dashboard</>}
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
            sub: 'Personen über alle Vereine',
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

      {/* ── Vereine ──
          Als Tabelle in einer Karte, nicht als freie Liste. Der Zwischenschritt
          ohne Rahmen (18.08.2026, vormittags) war ein Rückschritt: auf 1600 px
          Inhaltsbreite standen Name links und Kennzahlen rechts so weit
          auseinander, dass die Zeile nicht mehr als eine Einheit zu lesen war.
          Was fehlte, war nicht der Rahmen, sondern die Spalte — jetzt beides,
          gleiche Bauweise wie „Letzte Buchungen" im Admin-Dashboard. */}
      <Card className="p-0">
        <CardHeader className="flex-row items-start justify-between space-y-0 px-5 pb-3 pt-5">
          <div>
            <CardTitle className="text-sm font-semibold">Vereine</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {allClubs.length === 1 ? '1 Verein' : `${allClubs.length} Vereine`}
              {allClubs.length > 10 && ' · die 10 neuesten'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/owner/clubs?new=1"
              className="flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Verein anlegen
            </Link>
            <Link
              href="/owner/clubs"
              className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
            >
              Alle →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {allClubs.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Noch keine Vereine angelegt.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD_CELL}>Verein</TableHead>
                  {/* Feste Breiten für die schmalen Spalten — sonst verteilt der
                      Browser die Kartenbreite gleichmässig und zwischen Namen
                      und Zahl klafft eine Handbreit Nichts. */}
                  <TableHead className={cn(HEAD_CELL, 'w-[14%] text-right')}>Mitglieder</TableHead>
                  <TableHead className={cn(HEAD_CELL, 'w-[22%]')}>Status</TableHead>
                  <TableHead className={cn(HEAD_CELL, 'w-[12%] text-right')}>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allClubs.slice(0, 10).map((club: any) => (
                  <TableRow key={club.id}>
                    <TableCell className={cn(BODY_CELL, 'font-medium')}>{club.name}</TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-right tabular-nums')}>
                      {(membersByClub.get(club.id) ?? 0).toLocaleString('de-DE')}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-muted-foreground')}>
                      {club.status === 'inactive' ? (
                        <Badge variant="secondary">Inaktiv</Badge>
                      ) : !adminsByClub.get(club.id) ? (
                        <span className="text-warning-700 dark:text-warning-300">kein Admin</span>
                      ) : !club.setup_completed_at ? (
                        'Einrichtung offen'
                      ) : (
                        'Aktiv'
                      )}
                    </TableCell>
                    <TableCell className={cn(BODY_CELL, 'text-right')}>
                      <Link
                        href={`/api/admin/switch-club-redirect?clubId=${club.id}`}
                        className="whitespace-nowrap text-[12.5px] font-medium text-primary hover:underline"
                      >
                        Als Admin →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Letzte Plattform-Aktivität ──
          Der Owner ist die einzige Rolle mit Sicht über alle Vereine; ohne
          diesen Auszug müsste er das Audit-Log aktiv aufsuchen, um zu sehen,
          dass überhaupt etwas passiert ist. */}
      <Card className="p-0">
        <CardHeader className="flex-row items-start justify-between space-y-0 px-5 pb-3 pt-5">
          <CardTitle className="text-sm font-semibold">Letzte Aktivität</CardTitle>
          <Link
            href="/owner/audit"
            className="shrink-0 text-[12.5px] font-medium text-primary hover:underline"
          >
            Audit-Log →
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Zeitstempel links als eigene Spalte — ein Protokoll liest man
                    der Zeit nach. Das Schriftrollen-Symbol an jeder Zeile ist
                    weg: es stand an allen Einträgen gleich und unterschied
                    damit nichts. */}
                <TableHead className={cn(HEAD_CELL, 'w-[14%]')}>Zeit</TableHead>
                <TableHead className={HEAD_CELL}>Vorgang</TableHead>
                <TableHead className={cn(HEAD_CELL, 'w-[20%] text-right')}>Ausgelöst von</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((recentAudit ?? []) as any[]).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className={cn(BODY_CELL, 'text-muted-foreground tabular-nums')}>
                    {new Date(entry.created_at).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  {/* Nur „Geändert" sieht für jeden Vorgang gleich aus — erst mit
                      dem betroffenen Objekt wird die Zeile lesbar. */}
                  <TableCell className={BODY_CELL}>
                    {auditActionLabel(entry.action)}{' '}
                    <span className="text-muted-foreground">{auditSubject(entry)}</span>
                  </TableCell>
                  <TableCell className={cn(BODY_CELL, 'text-right text-muted-foreground')}>
                    {entry.actor?.full_name ?? entry.actor?.email ?? 'System'}
                  </TableCell>
                </TableRow>
              ))}
              {((recentAudit ?? []) as any[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className={cn(BODY_CELL, 'text-muted-foreground')}>
                    Noch keine Ereignisse aufgezeichnet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Schnellaktionen */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">Schnellaktionen</p>
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
              className="flex items-center gap-3 p-3 rounded-xl border border-border dark:border-white/10 hover:bg-muted/60 transition-colors bg-card"
            >
              <action.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
