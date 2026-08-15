'use client';

import { Suspense } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
  isPast,
} from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MessageSquare,
  Calendar as CalendarIcon,
  MapPin,
  CalendarCheck,
  CheckCircle2,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportBookingsCSV } from '@/lib/csv-export';
import { useUserClub, useUserMember, useUserRoles } from '@/hooks/use-user-data';
import {
  useSessions,
  useCreateBooking,
  useCancelBooking,
  useUpdateBookingStatus,
  type Session,
} from '@/hooks/use-sessions';
import FeedbackModal from '@/components/feedback/feedback-modal';
import SessionWaitlistButton from '@/components/session-waitlist-button';
import { MyBookings } from '@/components/bookings/my-bookings';
import { AnimatedCounter, ScrollReveal } from '@/components/animations';
import { Card, CardContent } from '@/components/ui/card';
import UnifiedCourtCalendar from '@/components/unified-court-calendar';

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Laden...</div>}>
      <BookingsContent />
    </Suspense>
  );
}

function BookingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') || 'courts';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [feedbackModal, setFeedbackModal] = useState<{
    open: boolean;
    sessionId: string;
    trainerId: string;
    trainerName: string;
    sessionTitle: string;
  }>({
    open: false,
    sessionId: '',
    trainerId: '',
    trainerName: '',
    sessionTitle: '',
  });

  // Update tab when URL param changes
  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && (tab === 'bookings' || tab === 'courts' || tab === 'my')) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data: clubData, error: clubError } = useUserClub();
  const { data: memberData } = useUserMember();
  const { data: userRoles = [] } = useUserRoles();

  const clubId = clubData?.clubId ?? null;
  const memberId = memberData?.memberId ?? null;

  const { data: sessions = [], isLoading, error: sessionsError } = useSessions(clubId);

  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();
  const updateBookingStatus = useUpdateBookingStatus();

  const handleBooking = useCallback(
    (sessionId: string) => {
      if (!memberId || !clubId) {
        toast.error('Member-ID oder Club-ID nicht verfügbar');
        return;
      }
      createBooking.mutate({ memberId, sessionId, clubId });
    },
    [memberId, clubId, createBooking]
  );

  const handleCancelBooking = useCallback(
    (sessionId: string, bookingId: string) => {
      if (!clubId) return;
      cancelBooking.mutate({ bookingId, sessionId, clubId });
    },
    [clubId, cancelBooking]
  );

  const handleStatusChange = useCallback(
    (bookingId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'no_show') => {
      if (!clubId) return;
      updateBookingStatus.mutate({ bookingId, status: newStatus, clubId });
    },
    [clubId, updateBookingStatus]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSessionsForDay = (date: Date): Session[] => {
    const jsDay = date.getDay();
    const apiDay = jsDay === 0 ? 7 : jsDay;
    // Use local date string to avoid UTC timezone shift (format: YYYY-MM-DD)
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    return sessions.filter((s: Session) => {
      // If session has a specific date (timeslotStart), match exactly
      const ts = (s as Session & { timeslotStart?: string }).timeslotStart;
      if (ts) {
        return String(ts).substring(0, 10) === dateStr;
      }
      // Fallback: match by dayOfWeek (for recurring sessions without specific dates)
      return s.dayOfWeek === apiDay;
    });
  };

  const getBookingStatusLabel = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return 'Bestätigt';
      case 'cancelled':
        return 'Storniert';
      case 'no_show':
        return 'Nicht erschienen';
      case 'pending':
        return 'Ausstehend';
      default:
        return status;
    }
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const openFeedbackModal = useCallback((session: any, date: Date) => {
    // Check if session is in the past
    const sessionDateTime = new Date(date);
    const [hours, minutes] = session.endTime.split(':');
    sessionDateTime.setHours(parseInt(hours), parseInt(minutes));

    if (isPast(sessionDateTime)) {
      setFeedbackModal({
        open: true,
        sessionId: session.id,
        trainerId: session.trainerId,
        trainerName: session.trainerName || 'Trainer',
        sessionTitle: `${session.startTime} - ${session.endTime}`,
      });
    }
  }, []);

  const handleExportCSV = () => {
    const data = sessions.map((s: Session) => ({
      id: s.id,
      status: s.bookingStatus || 'n/a',
      bookedAt: new Date().toISOString(),
      session: s.bookedByUser
        ? {
            startTime: s.startTime,
            endTime: s.endTime,
            trainerId: s.trainerId,
            court: s.trainerName || '-',
          }
        : null,
      ...(memberId ? { memberId } : {}),
    }));
    exportBookingsCSV(data);
    toast.success('Buchungs-Export gestartet');
  };

  if (clubError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-error-600">Kein Vereinszugang gefunden</div>
      </div>
    );
  }

  if (sessionsError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-error-600">Fehler beim Laden der Sessions</div>
      </div>
    );
  }

  // Stat calculations
  const totalSessions = sessions.length;
  const myBookings = sessions.filter((s: Session) => s.bookedByUser).length;
  const confirmedBookings = sessions.filter(
    (s: Session) => s.bookedByUser && s.bookingStatus === 'confirmed'
  ).length;
  const availableSlots = sessions.filter((s: Session) => !s.bookedByUser).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender & Reservierungen"
        description="Platzverfügbarkeit, Training und Buchungen verwalten"
        actions={[{ label: 'Neue Platzbuchung', href: '/dashboard/bookings/new' }]}
      />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScrollReveal delay={0}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Sessions</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={totalSessions} />
                  </p>
                  <p className="text-xs text-muted-foreground">diesen Monat</p>
                </div>
                <div className="p-3 rounded-xl bg-info-500 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <CalendarIcon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Meine Buchungen</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={myBookings} />
                  </p>
                  <p className="text-xs text-muted-foreground">reserviert</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-brand-light text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <CalendarCheck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Bestätigt</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={confirmedBookings} />
                  </p>
                  <p className="text-xs text-muted-foreground">aktive Buchungen</p>
                </div>
                <div className="p-3 rounded-xl bg-success-500 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={240}>
          <Card className="group cursor-pointer hover-lift transition-all duration-300 border border-border dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Frei</p>
                  <p className="text-3xl font-bold text-foreground dark:text-white">
                    <AnimatedCounter value={availableSlots} />
                  </p>
                  <p className="text-xs text-muted-foreground">verfügbare Plätze</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-brand-accent to-brand-accent-700 text-white shadow-lg transition-all duration-300 group-hover:scale-110">
                  <Timer className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      {/* ── Tabs ── */}
      <ScrollReveal delay={300}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="courts" className="flex items-center gap-2 min-w-0">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">Platz-Kalender</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2 min-w-0">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">Trainerstunden</span>
            </TabsTrigger>
            <TabsTrigger value="my" className="flex items-center gap-2 min-w-0">
              <CalendarCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">Meine Buchungen</span>
            </TabsTrigger>
          </TabsList>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="mt-6">
            <div className="space-y-4">
              {/* Calendar Controls */}
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[100px] text-center font-medium text-sm md:text-base">
                    {format(currentMonth, 'MMMM yyyy', { locale: de })}
                  </span>
                  <Button variant="outline" size="icon" onClick={goToNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Laden...</div>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4">
                  <div className="grid grid-cols-7 gap-px bg-muted dark:bg-muted rounded-xl overflow-hidden min-w-[600px]">
                    {/* Day headers */}
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                      <div
                        key={day}
                        className="bg-muted dark:bg-muted p-2 md:p-3 text-center font-semibold text-foreground dark:text-foreground text-xs md:text-sm"
                      >
                        {day}
                      </div>
                    ))}

                    {/* Calendar days */}
                    {calendarDays.map((day, idx) => {
                      const daySessions = getSessionsForDay(day);
                      const isCurrentMonth = isSameMonth(day, currentMonth);

                      return (
                        <div
                          key={idx}
                          className={`min-h-[5rem] md:min-h-[6.25rem] bg-background dark:bg-card p-1 md:p-2 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                        >
                          <div className="text-xs font-medium text-muted-foreground dark:text-muted-foreground mb-1">
                            {format(day, 'd')}
                          </div>
                          <div className="space-y-1">
                            {daySessions.map((session) => (
                              <div
                                key={session.id}
                                className={`p-1 rounded text-xs transition-colors ${
                                  session.bookedByUser
                                    ? 'bg-error-50 text-error-800 border border-error-200'
                                    : (session.currentBookings ?? 0) >= session.maxParticipants
                                      ? 'bg-warning-50 text-warning-800 dark:bg-warning-900/20 dark:text-warning-300'
                                      : 'bg-info-50 text-info-800 hover:bg-info-100 cursor-pointer'
                                }`}
                                role="button"
                                tabIndex={
                                  session.bookedByUser ||
                                  (session.currentBookings ?? 0) >= session.maxParticipants
                                    ? -1
                                    : 0
                                }
                                onKeyDown={(e) => {
                                  if (
                                    (e.key === 'Enter' || e.key === ' ') &&
                                    !session.bookedByUser &&
                                    (session.currentBookings ?? 0) < session.maxParticipants
                                  ) {
                                    e.preventDefault();
                                    handleBooking(session.id);
                                  }
                                }}
                                onClick={() =>
                                  !session.bookedByUser &&
                                  (session.currentBookings ?? 0) < session.maxParticipants &&
                                  handleBooking(session.id)
                                }
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="font-medium truncate">{session.startTime}</div>
                                  {session.bookedByUser && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (session.bookingId) {
                                          handleCancelBooking(session.id, session.bookingId);
                                        }
                                      }}
                                      className="ml-1 p-0.5 rounded hover:bg-error-100 text-error-600 transition-colors"
                                      title="Buchung stornieren"
                                    >
                                      <svg
                                        className="h-3 w-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-2xs">
                                  <Clock className="h-3 w-3" />
                                  <span className="truncate">
                                    {session.trainerName || session.trainerId}
                                  </span>
                                </div>
                                {session.bookedByUser && session.bookingStatus && (
                                  <div className="flex flex-col gap-1 mt-0.5">
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium ${
                                          session.bookingStatus === 'confirmed'
                                            ? 'bg-success-100 text-success-700'
                                            : session.bookingStatus === 'cancelled'
                                              ? 'bg-error-100 text-error-700'
                                              : session.bookingStatus === 'no_show'
                                                ? 'bg-muted text-foreground'
                                                : 'bg-warning-100 text-warning-700'
                                        }`}
                                      >
                                        {getBookingStatusLabel(session.bookingStatus)}
                                      </span>
                                      {(userRoles.includes('admin') ||
                                        userRoles.includes('superadmin') ||
                                        userRoles.includes('trainer')) && (
                                        <Select
                                          value={session.bookingStatus}
                                          onValueChange={(v) =>
                                            session.bookingId &&
                                            handleStatusChange(
                                              session.bookingId,
                                              v as 'pending' | 'confirmed' | 'cancelled' | 'no_show'
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-6 text-2xs px-1 py-0">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="pending">Ausstehend</SelectItem>
                                            <SelectItem value="confirmed">Bestätigt</SelectItem>
                                            <SelectItem value="cancelled">Storniert</SelectItem>
                                            <SelectItem value="no_show">
                                              Nicht erschienen
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                    {(() => {
                                      const sessionDateTime = new Date(day);
                                      const [hours, minutes] = session.endTime.split(':');
                                      sessionDateTime.setHours(parseInt(hours), parseInt(minutes));
                                      return (
                                        isPast(sessionDateTime) &&
                                        session.bookingStatus === 'confirmed'
                                      );
                                    })() && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openFeedbackModal(session, day);
                                        }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs bg-info-50 text-info-700 hover:bg-info-100 transition-colors"
                                        title="Feedback geben"
                                      >
                                        <MessageSquare className="h-3 w-3" />
                                        Feedback
                                      </button>
                                    )}
                                  </div>
                                )}
                                {/* Warteliste: nur wenn Session voll und noch nicht gebucht */}
                                {!session.bookedByUser &&
                                  (session.currentBookings ?? 0) >= session.maxParticipants &&
                                  clubId && (
                                    <SessionWaitlistButton
                                      sessionId={session.id}
                                      clubId={clubId}
                                      currentBookings={session.currentBookings ?? 0}
                                      maxParticipants={session.maxParticipants}
                                      bookedByUser={!!session.bookedByUser}
                                    />
                                  )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Courts Tab */}
          <TabsContent value="courts" className="mt-6">
            <UnifiedCourtCalendar />
          </TabsContent>

          <TabsContent value="my" className="mt-6">
            <MyBookings />
          </TabsContent>
        </Tabs>
      </ScrollReveal>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModal.open}
        onOpenChange={(open) => setFeedbackModal({ ...feedbackModal, open })}
        sessionId={feedbackModal.sessionId}
        trainerId={feedbackModal.trainerId}
        trainerName={feedbackModal.trainerName}
        sessionTitle={feedbackModal.sessionTitle}
      />
    </div>
  );
}
