import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  Calendar,
  BookOpen,
  CreditCard,
  Bell,
  MapPin,
  Trophy,
  ChevronRight,
  Clock,
  ArrowRight,
  Zap,
  GraduationCap,
  Sparkles,
  ClipboardCheck,
  HardHat,
} from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { QuickActions } from '@/components/ui/quick-actions';
import { MemberHeroActions } from '@/components/member-hero-actions';
import { TennisBallEmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';

export default async function MemberPage() {
  const { supabase, user } = await requireAuth();

  // Use .limit(1) instead of .maybeSingle() to gracefully handle users
  // with multiple club memberships (e.g. multi-tenant setups).  maybeSingle()
  // throws when >1 row is returned, which causes the onboarding form to show
  // even for active members.
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  const membership = memberships?.[0] ?? null;

  if (!membership) {
    return (
      <TennisBallEmptyState
        title="Keine aktive Mitgliedschaft"
        description="Du bist aktuell keinem Verein zugeordnet. Bitte wende dich an den Administrator deines Vereins."
        size="md"
      />
    );
  }

  const clubsData = membership.clubs;
  const club = Array.isArray(clubsData) ? clubsData[0] : clubsData;
  const clubId = membership.club_id;

  const { data: clubRow } = await supabase
    .from('clubs')
    .select('features')
    .eq('id', clubId)
    .single();
  const features = (clubRow?.features as Record<string, boolean>) ?? {};

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const firstName =
    profile?.full_name?.split(' ')[0] ||
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'Mitglied';

  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('id, session_start_time, status, sessions(id, courts(name))')
    .eq('member_id', user.id)
    .eq('status', 'confirmed')
    .gte('session_start_time', new Date().toISOString())
    .order('session_start_time', { ascending: true })
    .limit(3);

  const { data: nextSessions } = await supabase
    .from('sessions')
    .select('id, timeslot_start, timeslot_end, courts(name), schedules(club_id)')
    .eq('schedules.club_id', clubId)
    .gte('timeslot_start', new Date().toISOString())
    .order('timeslot_start', { ascending: true })
    .limit(3);

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  const { count: openInvCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
    .eq('status', 'open');

  const bookingCount = upcomingBookings?.length ?? 0;
  const notifCount = unreadCount ?? 0;
  const invoiceCount = openInvCount ?? 0;

  const nextSession = (nextSessions ?? []).length > 0 ? nextSessions![0] : null;
  const nextCourt = nextSession
    ? (() => {
        const c = nextSession.courts;
        return c ? (Array.isArray(c) ? c[0] : c) : null;
      })()
    : null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-foreground dark:text-white">
            Hallo, {firstName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {club?.name ?? 'Mein Verein'} · Mitglied
          </p>
          <MemberHeroActions />
        </div>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-light flex items-center justify-center text-white font-bold text-sm shadow-sm">
          {firstName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* ── Next Session (Hero Card) ── */}
      {nextSession ? (
        <Link href="/bookings">
          <Card className="border border-border dark:border-white/10 cursor-pointer hover:border-brand-light/40 hover:shadow-sm transition-all duration-300 group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <IconBox icon={Zap} size="sm" variant="light" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nächste Session
                  </p>
                </div>
                {isToday(nextSession.timeslot_start) && (
                  <span className="text-2xs font-bold bg-brand-light/10 text-brand-light px-3 py-1 rounded-full">
                    HEUTE
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-foreground dark:text-white">
                    {nextCourt?.name ?? 'Training'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDate(nextSession.timeslot_start)} ·{' '}
                    {formatTime(nextSession.timeslot_start)}–{formatTime(nextSession.timeslot_end)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground/40 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <Card className="border border-border dark:border-white/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <IconBox icon={Sparkles} size="lg" variant="light" />
              <div>
                <p className="font-semibold text-foreground">Bereit für dein erstes Training?</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Buche jetzt deine erste Session und starte durch.
                </p>
                <Link
                  href="/bookings"
                  className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-brand-light hover:underline"
                >
                  Jetzt buchen <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Calendar}
          label="Buchungen"
          value={bookingCount}
          sub="bevorstehend"
          color="brand"
          href="/bookings"
          {...(bookingCount > 0 ? { badge: bookingCount } : {})}
        />
        <StatCard
          icon={CreditCard}
          label="Rechnungen"
          value={invoiceCount}
          sub={invoiceCount > 0 ? 'zu bezahlen' : 'offen'}
          color={invoiceCount > 0 ? 'red' : 'gray'}
          href="/billing"
        />
        <StatCard
          icon={Bell}
          label="Benachrichtigungen"
          value={notifCount}
          sub={notifCount > 0 ? 'ungelesen' : 'keine neuen'}
          color={notifCount > 0 ? 'blue' : 'gray'}
          href="/notifications"
        />
        <StatCard
          icon={BookOpen}
          label="Training"
          value={(nextSessions ?? []).length}
          sub="kommende Sessions"
          color="green"
          href="/bookings"
        />
      </div>

      {/* ── Next Bookings ── */}
      {(upcomingBookings ?? []).length > 0 && (
        <Card className="border border-border dark:border-white/10 p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Nächste Buchungen
              <Link
                href="/bookings"
                className="text-xs text-brand-light hover:underline font-normal flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="divide-y divide-border dark:divide-white/5">
              {upcomingBookings!.map((b: any) => {
                const court = Array.isArray(b.sessions?.courts)
                  ? b.sessions.courts[0]
                  : b.sessions?.courts;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 py-3 hover:bg-muted/50 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <IconBox icon={MapPin} size="sm" variant="green" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {court?.name ?? 'Platz'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(b.session_start_time)} · {formatTime(b.session_start_time)}
                      </p>
                    </div>
                    <Badge className="text-2xs bg-success-50 text-success-700 border-success-200 font-medium">
                      Bestätigt
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Next Training Sessions ── */}
      {(nextSessions ?? []).length > 1 && (
        <Card className="border border-border dark:border-white/10 p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Trainingseinheiten
              <Link
                href="/bookings"
                className="text-xs text-brand-light hover:underline font-normal flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="divide-y divide-border dark:divide-white/5">
              {nextSessions!.slice(1, 4).map((s: any) => {
                const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 py-3 hover:bg-muted/50 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <IconBox icon={Clock} size="sm" variant="light" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {court?.name ?? 'Training'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(s.timeslot_start)} · {formatTime(s.timeslot_start)}–
                        {formatTime(s.timeslot_end)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <QuickActions
        label="Schnellzugriff"
        actions={[
          { label: 'Buchen', href: '/bookings', icon: Calendar, variant: 'light' },
          { label: 'Training', href: '/training-schedule', icon: BookOpen, variant: 'blue' },
          {
            label: 'Trainer',
            href: '/member/trainer-booking',
            icon: GraduationCap,
            variant: 'teal',
          },
          ...(features.tournaments === true
            ? [
                {
                  label: 'Turniere',
                  href: '/member/tournaments',
                  icon: Trophy,
                  variant: 'amber' as const,
                },
              ]
            : []),
          { label: 'Rechnungen', href: '/billing', icon: CreditCard, variant: 'purple' },
          ...(features.work_duty === true
            ? [
                {
                  label: 'Dienste',
                  href: '/member/work-duties',
                  icon: HardHat,
                  variant: 'amber' as const,
                },
              ]
            : []),
          {
            label: 'Präferenzen',
            href: '/member/preferences',
            icon: ClipboardCheck,
            variant: 'green',
          },
        ]}
      />
    </div>
  );
}
