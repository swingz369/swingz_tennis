import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Calendar,
  BookOpen,
  CreditCard,
  Bell,
  MapPin,
  Users,
  Trophy,
  ChevronRight,
  Clock,
  ArrowRight,
  Zap,
  GraduationCap,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function MemberPage() {
  const { supabase, user } = await requireAuth();

  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!membership) {
    redirect('/dashboard');
  }

  const clubsData = membership.clubs;
  const club = Array.isArray(clubsData) ? clubsData[0] : clubsData;
  const clubId = membership.club_id;

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
          <h1 className="text-2xl font-extrabold text-gray-900">
            Hallo, {firstName}! <span className="animate-float inline-block">👋</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{club?.name ?? 'Mein Verein'} · Mitglied</p>
        </div>
        <Link href="/profile">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-brand-primary to-brand-light flex items-center justify-center text-white font-bold shadow-md hover:shadow-lg transition-shadow">
            {firstName.charAt(0).toUpperCase()}
          </div>
        </Link>
      </div>

      {/* ── Next Session (Hero Card) ── */}
      {nextSession ? (
        <Link href="/training-schedule">
          <Card className="border-0 shadow-premium bg-gradient-to-br from-brand-primary via-brand-primary to-brand-light text-white cursor-pointer hover:shadow-glow-primary transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-white/75 uppercase tracking-wider">
                    Nächste Session
                  </p>
                </div>
                {isToday(nextSession.timeslot_start) && (
                  <span className="text-[11px] font-bold bg-white/25 text-white px-3 py-1 rounded-full animate-pulse-glow">
                    HEUTE
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-white">{nextCourt?.name ?? 'Training'}</p>
                  <p className="text-sm text-white/75 mt-1">
                    {formatDate(nextSession.timeslot_start)} ·{' '}
                    {formatTime(nextSession.timeslot_start)}–{formatTime(nextSession.timeslot_end)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-white/60 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <Card className="border-0 shadow-premium bg-gradient-to-br from-gray-50 to-gray-100/50 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 flex-shrink-0">
                <Sparkles className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Bereit für dein erstes Training?</p>
                <p className="text-sm text-gray-500 mt-1">
                  Buche jetzt deine erste Session und starte durch.
                </p>
                <Link
                  href="/bookings"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-brand-primary hover:text-brand-light transition-colors"
                >
                  Jetzt buchen <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/bookings">
          <Card className="border-0 shadow-elegant bg-gradient-to-br from-brand-light/8 to-brand-primary/5 hover:shadow-premium hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light/15 text-brand-light">
                  <Calendar className="h-5 w-5" />
                </div>
                {bookingCount > 0 && (
                  <span className="text-[11px] font-bold bg-brand-light/10 text-brand-light px-2 py-0.5 rounded-full">
                    {bookingCount}
                  </span>
                )}
              </div>
              <p className="text-3xl font-extrabold text-gray-900 tabular-nums">{bookingCount}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">Buchungen</p>
              <p className="text-[11px] text-gray-400">bevorstehend</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/billing">
          <Card
            className={`border-0 shadow-elegant cursor-pointer hover:shadow-premium hover:-translate-y-0.5 transition-all duration-300 group ${invoiceCount > 0 ? 'bg-gradient-to-br from-red-50 to-red-100/40' : 'bg-gradient-to-br from-gray-50 to-gray-100/40'}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${invoiceCount > 0 ? 'bg-red-100 text-red-500' : 'bg-gray-200 text-gray-400'}`}
                >
                  <CreditCard className="h-5 w-5" />
                </div>
                {invoiceCount > 0 && (
                  <span className="text-[11px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    {invoiceCount}
                  </span>
                )}
              </div>
              <p
                className={`text-3xl font-extrabold tabular-nums ${invoiceCount > 0 ? 'text-red-600' : 'text-gray-900'}`}
              >
                {invoiceCount}
              </p>
              <p className="text-xs font-medium text-gray-500 mt-1">Rechnungen</p>
              <p className="text-[11px] text-gray-400">
                {invoiceCount > 0 ? 'zu bezahlen' : 'offen'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notifications" className="col-span-2">
          <Card
            className={`border-0 shadow-elegant cursor-pointer hover:shadow-premium hover:-translate-y-0.5 transition-all duration-300 group ${notifCount > 0 ? 'bg-gradient-to-br from-blue-50 to-blue-100/40' : 'bg-gradient-to-br from-gray-50 to-gray-100/40'}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${notifCount > 0 ? 'bg-blue-100 text-blue-500' : 'bg-gray-200 text-gray-400'}`}
                  >
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Benachrichtigungen</p>
                    <p
                      className={`text-2xl font-extrabold tabular-nums ${notifCount > 0 ? 'text-blue-600' : 'text-gray-900'}`}
                    >
                      {notifCount}
                    </p>
                  </div>
                </div>
                {notifCount > 0 ? (
                  <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                    Ansehen <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">keine ungelesenen</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Next Bookings ── */}
      {(upcomingBookings ?? []).length > 0 && (
        <Card className="border-0 shadow-elegant">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              Nächste Buchungen
              <Link
                href="/bookings"
                className="text-xs text-brand-light hover:underline font-medium flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-0 divide-y divide-gray-50">
            {upcomingBookings!.map((b: any) => {
              const court = Array.isArray(b.sessions?.courts)
                ? b.sessions.courts[0]
                : b.sessions?.courts;
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 py-3 group hover:bg-gray-50/50 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <IconBox icon={MapPin} size="md" variant="green" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-gray-900">
                      {court?.name ?? 'Platz'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(b.session_start_time)} · {formatTime(b.session_start_time)}
                    </p>
                  </div>
                  <Badge className="text-[11px] bg-green-50 text-green-700 border-green-200 font-medium">
                    Bestätigt
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Next Training Sessions ── */}
      {(nextSessions ?? []).length > 1 && (
        <Card className="border-0 shadow-elegant">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              Trainingseinheiten
              <Link
                href="/training-schedule"
                className="text-xs text-brand-light hover:underline font-medium flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-0 divide-y divide-gray-50">
            {nextSessions!.slice(1, 4).map((s: any) => {
              const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 py-3 hover:bg-gray-50/50 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <IconBox icon={Clock} size="md" variant="light" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-gray-900">
                      {court?.name ?? 'Training'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(s.timeslot_start)} · {formatTime(s.timeslot_start)}–
                      {formatTime(s.timeslot_end)}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 px-1">
          Schnellzugriff
        </p>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            {
              label: 'Trainer',
              href: '/member/trainer-booking',
              icon: GraduationCap,
              color: 'bg-teal-50 text-teal-600 border-teal-100',
            },
            {
              label: 'Turniere',
              href: '/member/tournaments',
              icon: Trophy,
              color: 'bg-amber-50 text-amber-600 border-amber-100',
            },
            {
              label: 'Buchen',
              href: '/bookings',
              icon: Calendar,
              color: 'bg-brand-light/10 text-brand-light border-brand-light/20',
            },
            {
              label: 'Training',
              href: '/training-schedule',
              icon: BookOpen,
              color: 'bg-blue-50 text-blue-600 border-blue-100',
            },
            {
              label: 'Profil',
              href: '/profile',
              icon: Users,
              color: 'bg-amber-50 text-amber-600 border-amber-100',
            },
            {
              label: 'Rechnungen',
              href: '/billing',
              icon: CreditCard,
              color: 'bg-purple-50 text-purple-600 border-purple-100',
            },
            {
              label: 'Anwesenheit',
              href: '/attendance-history',
              icon: Clock,
              color: 'bg-rose-50 text-rose-600 border-rose-100',
            },
            {
              label: 'Präferenzen',
              href: '/member/preferences',
              icon: ClipboardCheck,
              color: 'bg-green-50 text-green-600 border-green-100',
            },
            {
              label: 'News',
              href: '/news',
              icon: Bell,
              color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
            },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-white border border-gray-100 hover:border-brand-light/30 hover:shadow-elegant transition-all active:scale-95 group"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${action.color} group-hover:scale-110 transition-transform duration-300`}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold text-center leading-tight text-gray-600 group-hover:text-gray-900 transition-colors">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
