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
  AlertCircle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    // No membership — redirect to dashboard which will show the no-membership state
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

  // Next training session (from schedule)
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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Hallo, {firstName}! 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {club?.name ?? 'Mein Verein'} · Mitglied
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-[#40916C]/10 to-[#1B4332]/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Buchungen</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{bookingCount}</p>
                <p className="text-xs text-gray-400">bevorstehend</p>
              </div>
              <Calendar className="h-8 w-8 text-[#40916C] opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-0 shadow-sm ${invoiceCount > 0 ? 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10' : 'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/20'}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rechnungen</p>
                <p
                  className={`text-2xl font-bold ${invoiceCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
                >
                  {invoiceCount}
                </p>
                <p className="text-xs text-gray-400">offen</p>
              </div>
              <CreditCard
                className={`h-8 w-8 opacity-60 ${invoiceCount > 0 ? 'text-red-500' : 'text-gray-400'}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-0 shadow-sm col-span-2 ${notifCount > 0 ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10' : 'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/20'}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Benachrichtigungen</p>
                <p
                  className={`text-2xl font-bold ${notifCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}
                >
                  {notifCount}
                </p>
                <p className="text-xs text-gray-400">ungelesen</p>
              </div>
              <Bell
                className={`h-8 w-8 opacity-60 ${notifCount > 0 ? 'text-blue-500' : 'text-gray-400'}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next booking */}
      {(upcomingBookings ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
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
          <CardContent className="space-y-2">
            {upcomingBookings!.map((b: any) => {
              const court = Array.isArray(b.sessions?.courts)
                ? b.sessions.courts[0]
                : b.sessions?.courts;
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 py-2 border-b last:border-0 border-gray-100 dark:border-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#40916C]/10 shrink-0">
                    <MapPin className="h-4 w-4 text-[#40916C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{court?.name ?? 'Platz'}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(b.session_start_time)} · {formatTime(b.session_start_time)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Bestätigt
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Next training sessions */}
      {(nextSessions ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
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
          <CardContent className="space-y-2">
            {nextSessions!.slice(0, 3).map((s: any) => {
              const court = Array.isArray(s.courts) ? s.courts[0] : s.courts;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 py-2 border-b last:border-0 border-gray-100 dark:border-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20 shrink-0">
                    <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{court?.name ?? 'Training'}</p>
                    <p className="text-xs text-gray-500">
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

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Schnellzugriff
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
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
              icon: Trophy,
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
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-[#40916C]/40 hover:shadow-sm transition-all"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}
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
