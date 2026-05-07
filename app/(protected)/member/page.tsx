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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function MemberPage() {
  const { supabase, user } = await requireAuth();

  // Fetch membership + club
  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!membership) {
    redirect('/dashboard');
  }

  const clubRaw = membership.clubs as any;
  const club = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
  const clubId = membership.club_id;

  // Fetch user profile
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

  // Upcoming bookings
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('id, session_start_time, status, sessions(id, courts(name))')
    .eq('member_id', user.id)
    .eq('status', 'confirmed')
    .gte('session_start_time', new Date().toISOString())
    .order('session_start_time', { ascending: true })
    .limit(3);

  // Next training session (from schedule) — top 1 for "Nächste Session" card
  const { data: nextSessions } = await supabase
    .from('sessions')
    .select('id, timeslot_start, timeslot_end, courts(name), schedules(club_id)')
    .eq('schedules.club_id', clubId)
    .gte('timeslot_start', new Date().toISOString())
    .order('timeslot_start', { ascending: true })
    .limit(3);

  // Unread notifications
  const { count: unreadNotifications } = await supabase
    .from('notifications' as any)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)
    .then((r: any) => ({ count: r.count ?? 0 }));

  // Open invoices
  const { count: openInvoices } = await supabase
    .from('invoices' as any)
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
    .eq('status', 'open')
    .then((r: any) => ({ count: r.count ?? 0 }));

  const bookingCount = upcomingBookings?.length ?? 0;
  const notifCount = (unreadNotifications as any) ?? 0;
  const invoiceCount = (openInvoices as any) ?? 0;

  // Next session (soonest upcoming)
  const nextSession = (nextSessions ?? []).length > 0 ? nextSessions![0] : null;
  const nextCourt = nextSession
    ? Array.isArray((nextSession as any).courts)
      ? (nextSession as any).courts[0]
      : (nextSession as any).courts
    : null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // Is next session today?
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
    <div className="space-y-5">
      {/* Header greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Hallo, {firstName}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {club?.name ?? 'Mein Verein'} · Mitglied
        </p>
      </div>

      {/* Nächste Session — most important card at top */}
      {nextSession ? (
        <Link href="/training-schedule">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-[#40916C] to-[#2d6a4f] text-white cursor-pointer hover:shadow-md transition-shadow p-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                    <Zap className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                    Nächste Session
                  </p>
                </div>
                {isToday((nextSession as any).timeslot_start) && (
                  <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                    HEUTE
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-white">{nextCourt?.name ?? 'Training'}</p>
                  <p className="text-sm text-white/80 mt-0.5">
                    {formatDate((nextSession as any).timeslot_start)} ·{' '}
                    {formatTime((nextSession as any).timeslot_start)}–
                    {formatTime((nextSession as any).timeslot_end)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-white/70" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      {/* Stat cards — taller, more breathing room */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/bookings">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-[#40916C]/10 to-[#1B4332]/5 hover:shadow-md transition-shadow cursor-pointer p-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="h-5 w-5 text-[#40916C]" />
                {bookingCount > 0 && (
                  <span className="text-[10px] font-bold bg-[#40916C]/10 text-[#40916C] px-1.5 py-0.5 rounded-full">
                    {bookingCount}
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                {bookingCount}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Buchungen</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">bevorstehend</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/billing">
          <Card
            className={`border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow p-0 ${
              invoiceCount > 0
                ? 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10'
                : 'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/20'
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <CreditCard
                  className={`h-5 w-5 ${invoiceCount > 0 ? 'text-red-500' : 'text-gray-400'}`}
                />
                {invoiceCount > 0 && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                    {invoiceCount}
                  </span>
                )}
              </div>
              <p
                className={`text-3xl font-bold tabular-nums ${
                  invoiceCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {invoiceCount}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
                Rechnungen
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {invoiceCount > 0 ? 'zu bezahlen' : 'offen'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notifications" className="col-span-2">
          <Card
            className={`border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow p-0 ${
              notifCount > 0
                ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10'
                : 'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/20'
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell
                    className={`h-5 w-5 ${notifCount > 0 ? 'text-blue-500' : 'text-gray-400'}`}
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Benachrichtigungen
                    </p>
                    <p
                      className={`text-2xl font-bold tabular-nums ${
                        notifCount > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {notifCount}
                    </p>
                  </div>
                </div>
                {notifCount > 0 ? (
                  <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Ansehen <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">ungelesen</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Next bookings */}
      {(upcomingBookings ?? []).length > 0 && (
        <Card className="p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Nächste Buchungen
              <Link
                href="/bookings"
                className="text-xs text-[#40916C] hover:underline font-normal flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-0 divide-y divide-gray-100 dark:divide-white/10">
            {upcomingBookings!.map((b: any) => {
              const court = Array.isArray(b.sessions?.courts)
                ? b.sessions.courts[0]
                : b.sessions?.courts;
              return (
                <div key={b.id} className="flex items-center gap-3 py-3 group">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#40916C]/10 shrink-0">
                    <MapPin className="h-4 w-4 text-[#40916C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                      {court?.name ?? 'Platz'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(b.session_start_time)} · {formatTime(b.session_start_time)}
                    </p>
                  </div>
                  <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/30 shrink-0">
                    Bestätigt
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Next training sessions */}
      {(nextSessions ?? []).length > 1 && (
        <Card className="p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              Nächste Trainingseinheiten
              <Link
                href="/training-schedule"
                className="text-xs text-[#40916C] hover:underline font-normal flex items-center gap-1"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-0 divide-y divide-gray-100 dark:divide-white/10">
            {nextSessions!.slice(1, 4).map((s: any) => {
              const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
              return (
                <div key={s.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/20 shrink-0">
                    <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
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

      {/* Quick Actions grid — better spacing, 3-column */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Schnellzugriff
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Trainer buchen',
              href: '/member/trainer-booking',
              icon: GraduationCap,
              color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
            },
            {
              label: 'Turniere',
              href: '/member/tournaments',
              icon: Trophy,
              color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
            },
            {
              label: 'Platz buchen',
              href: '/bookings',
              icon: Calendar,
              color: 'bg-[#40916C]/10 text-[#40916C]',
            },
            {
              label: 'Training',
              href: '/training-schedule',
              icon: BookOpen,
              color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
            },
            {
              label: 'Profil',
              href: '/profile',
              icon: Users,
              color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
            },
            {
              label: 'Rechnungen',
              href: '/billing',
              icon: CreditCard,
              color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
            },
            {
              label: 'Anwesenheit',
              href: '/attendance-history',
              icon: Users,
              color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
            },
            {
              label: 'News',
              href: '/news',
              icon: Bell,
              color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
            },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-[#40916C]/40 hover:shadow-sm transition-all active:scale-95"
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.color}`}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-center leading-tight text-gray-700 dark:text-gray-300">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
