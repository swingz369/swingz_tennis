'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { format } from 'date-fns';
import { de } from '@/lib/locale';
import { ChevronLeft } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import CourtBookingsList from '@/components/court-bookings-list';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserClub, useUserMember, useUserRoles } from '@/hooks/use-user-data';
import { useActingAsMemberId } from '@/hooks/use-effective-member';
import { useCourts } from '@/hooks/use-courts';
import { BookingConfirmDialog } from '@/components/booking/booking-confirm-dialog';
import { useSessions, type Session } from '@/hooks/use-sessions';
import { MonthView } from '@/components/calendar/month-view';
import { AgendaView } from '@/components/calendar/agenda-view';
import { WeekView } from '@/components/calendar/week-view';
import { DayView } from '@/components/calendar/day-view';
import { DraggableSessionCard } from '@/components/calendar/calendar-primitives';
import {
  WeatherBanner,
  ActiveClosuresBanner,
  ZeroSessionsWarning,
} from '@/components/calendar/calendar-banners';
import {
  CalendarLoadingSkeleton,
  NoCourtsEmptyState,
} from '@/components/calendar/calendar-loading-states';
import {
  CalendarViewToggle,
  CalendarRoleActions,
} from '@/components/calendar/calendar-header-controls';
import {
  useTrainerHourSlots,
  useBookTrainerHourSlot,
  useWaitlistTrainerHourSlot,
} from '@/hooks/use-trainer-hour-slots';
import type { PlanEntry } from '@/components/calendar/types';
import { useCalendarVisibility } from '@/hooks/use-calendar-visibility';
import { useBlockCourtDialog } from '@/hooks/use-block-court-dialog';
import { useAdHocSessionDialog } from '@/hooks/use-ad-hoc-session-dialog';
import { useSessionCancelDialog } from '@/hooks/use-session-cancel-dialog';
import { useCourtWeatherAndClosures } from '@/hooks/use-court-weather-and-closures';
import { useHolidays } from '@/hooks/use-holidays';
import { useCalendarState, type ViewMode } from '@/hooks/use-calendar-state';
import { useActiveSeasonId } from '@/hooks/use-active-season-id';
import { useTrainerRecordId } from '@/hooks/use-trainer-record-id';
import { useCourtBookingActions } from '@/hooks/use-court-booking-actions';
import { useCourtSessionDnd } from '@/hooks/use-court-session-dnd';
import { useNextFreeSlot } from '@/hooks/use-next-free-slot';
import { useSeasonPlanGrid } from '@/hooks/use-season-plan-entries';
import { useMemberGroupIds } from '@/hooks/use-member-groups';
import { exportSessionsToICS } from '@/lib/calendar-export';
import { getSurfaceLabel, getCalendarLegendItems } from '@/lib/court-calendar-utils';
import { CourtCalendarHeader, CourtCalendarLegend } from '@/components/court-calendar-shared';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api-fetch';
import { BlockCourtDialog } from '@/components/block-court-dialog';
import { AdHocSessionDialog } from '@/components/ad-hoc-session-dialog';

/* ─────────────────── Types ─────────────────── */

interface UnifiedCourtCalendarProps {
  /** Override view mode (default: agenda) */
  defaultView?: ViewMode;
  /** Override club ID (for admin pages) */
  initialClubId?: string;
}

/* ─────────────────── Constants ─────────────────── */

/** Breakpoint width (px) below which we force the daily view */
const MOBILE_BREAKPOINT = 768;

/* ─────────────────── Mobile Detection Hook ─────────────────── */

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

/* ─────────────────── Main Component ─────────────────── */

export default function UnifiedCourtCalendar({
  defaultView,
  initialClubId,
}: UnifiedCourtCalendarProps) {
  // ── Agenda view (Tages-Buchungsflow) state ──
  const [agendaExpandedSlot, setAgendaExpandedSlot] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // ── Session Cancel Dialog ──
  const sessionCancelDialog = useSessionCancelDialog();
  const handleOpenCancelSession = sessionCancelDialog.open;

  // ── User context ──
  const { data: clubData } = useUserClub();
  const openingHours = clubData?.club?.openingHours ?? null;
  const { data: memberData } = useUserMember();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles();

  const clubId = clubData?.clubId ?? initialClubId ?? null;
  const activeSeasonId = useActiveSeasonId(clubId);
  const actingAsMemberId = useActingAsMemberId();
  const memberId = actingAsMemberId ?? memberData?.memberId ?? null;
  const isAdmin = userRoles.some((r) => r === 'admin' || r === 'superadmin');
  const isTrainer = userRoles.some((r) => r === 'trainer');
  const { weatherData, courtClosures, refetchClosures } = useCourtWeatherAndClosures(
    clubId,
    isAdmin
  );

  const dayOffFor = useHolidays(clubId);

  // ── Ansicht/Datum/Platz + URL-Synchronisation (Phase 1) ──
  const {
    viewMode,
    setViewMode,
    currentWeek,
    setCurrentWeek,
    selectedDate,
    setSelectedDate,
    mobileSelectedDay,
    setMobileSelectedDay,
    selectedCourtId,
    setSelectedCourtId,
    weekStart,
    weekEnd,
    weekDays,
    goToPrevious,
    goToNext,
    goToToday,
  } = useCalendarState({ defaultView, isMobile, isAdmin, isTrainer, rolesLoading });

  const trainerRecordId = useTrainerRecordId(isTrainer);

  // ── Data fetching ──
  const { data: courts = [], isLoading: courtsLoading } = useCourts(clubId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(
    clubId,
    undefined,
    actingAsMemberId
  );
  const { data: seasonPlanData } = useSeasonPlanGrid(activeSeasonId);
  const planSlots: PlanEntry[] = useMemo(() => seasonPlanData?.slots ?? [], [seasonPlanData]);

  // ── Member group filtering (role-based view) ──
  const { data: memberGroupIds = [] } = useMemberGroupIds(clubId);

  // ── Trainerstunden (vierte Slot-Quelle, Phase 2.1.2) — nur für die Agenda-
  // Ansicht des jeweils ausgewählten Tages geladen, sie sind platzunabhängig. ──
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: trainerHourSlots = [] } = useTrainerHourSlots(
    clubId,
    selectedDateStr,
    selectedDateStr
  );
  const trainerHourSlotsForDay = useMemo(
    () => trainerHourSlots.filter((s) => s.date === selectedDateStr),
    [trainerHourSlots, selectedDateStr]
  );
  const bookTrainerHourSlot = useBookTrainerHourSlot();
  const waitlistTrainerHourSlot = useWaitlistTrainerHourSlot();

  /** Sessions visible to the current user. Admin sees all; trainer sees own sessions; member sees group sessions + own bookings. */
  const { visibleSessions, visiblePlanSlots } = useCalendarVisibility({
    sessions,
    planSlots,
    isAdmin,
    isTrainer,
    trainerRecordId,
    memberGroupIds,
  });

  // ── Court selection: derive effective court ID ──
  // If courts loaded but selected court no longer exists, fall back to card view
  const selectedCourt = selectedCourtId ? courts.find((c) => c.id === selectedCourtId) : null;
  const effectiveCourtId =
    selectedCourtId && courts.length > 0 && !selectedCourt ? null : selectedCourtId;

  const queryClient = useQueryClient();

  // ── Buchungs-Aktionen (Buchen, Stornieren, Direktbuchung, Monatsansicht) ──
  const {
    handleBookSession,
    handleStatusChange,
    handleBookSlot,
    handleCancelBooking,
    bookingDialog,
  } = useCourtBookingActions({ clubId, memberId, sessions, openingHours, courts });

  // ── DnD (Admin) ──
  const { activeId, draggedSession, sensors, handleDragStart, handleDragEnd } =
    useCourtSessionDnd(sessions);

  // ── Plan entries + "Nächster freier Platz" ──
  const { getPlanEntriesForCourtAndDay, getPlanEntriesForNextFree, nextFreeSlot } = useNextFreeSlot(
    {
      visiblePlanSlots,
      courts,
      visibleSessions,
      courtClosures,
      openingHours,
    }
  );

  // ── Slot blocking (admin) — Zustand + Absende-Logik in useBlockCourtDialog,
  //    geteilt zwischen Modal (Wochen-/Tagesansicht) und Inline-Panel (Agenda) ──
  const blockDialog = useBlockCourtDialog({
    clubId,
    onBlocked: () => void queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const openBlockDialog = blockDialog.open;

  const [confirm, confirmDialog] = useConfirmDialog();

  const handleUnblockSlot = useCallback(
    async (sessionId: string) => {
      const confirmed = await confirm({
        title: 'Sperrung aufheben',
        description: 'Sperrung aufheben? Der Platz wird wieder freigegeben.',
        confirmLabel: 'Aufheben',
        variant: 'warning',
      });
      if (!confirmed) return;
      try {
        const res = await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          toast.error(extractErrorMessage(err) ?? 'Sperrung konnte nicht aufgehoben werden');
          return;
        }
        toast.success('Sperrung aufgehoben');
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      } catch {
        toast.error('Netzwerkfehler beim Entsperren');
      }
    },
    [confirm, queryClient]
  );

  // ── Closure (court_closures) unblock — separate von handleUnblockSlot, das nur
  //    sessions-basierte Blocks kennt ──
  const handleRemoveClosure = useCallback(
    async (closureId: string) => {
      const confirmed = await confirm({
        title: 'Sperrung aufheben',
        description: 'Sperrung aufheben? Der Platz wird wieder freigegeben.',
        confirmLabel: 'Aufheben',
        variant: 'warning',
      });
      if (!confirmed) return;
      try {
        const res = await apiFetch(`/api/weather/closures/${closureId}`, { method: 'DELETE' });
        if (!res.ok) {
          toast.error('Sperrung konnte nicht aufgehoben werden');
          return;
        }
        toast.success('Sperrung aufgehoben');
        void refetchClosures();
      } catch {
        toast.error('Netzwerkfehler beim Entsperren');
      }
    },
    [confirm, refetchClosures]
  );

  // ── Trainer: einmalige Einheit eintragen — Zustand + Absende-Logik in
  //    useAdHocSessionDialog, geteilt zwischen Modal und Inline-Panel (Agenda) ──
  const adHocDialog = useAdHocSessionDialog({
    clubId,
    onCreated: () => void queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const openAdHocDialog = adHocDialog.open;

  // ── Export helpers ──
  const handleExportICS = useCallback(() => {
    try {
      const exportCourts = effectiveCourtId
        ? courts.filter((c) => c.id === effectiveCourtId)
        : courts;
      // Nur Sessions mit konkretem Datum exportieren — eine wiederkehrende Session
      // ohne timeslotStart hätte parseISO(undefined) ergeben (Invalid Date im ICS).
      const exportableSessions = visibleSessions.filter(
        (s): s is Session & { timeslotStart: string } => !!s.timeslotStart
      );
      exportSessionsToICS(exportableSessions, exportCourts);
      toast.success('ICS-Export erfolgreich');
    } catch {
      toast.error('ICS-Export fehlgeschlagen');
    }
  }, [visibleSessions, courts, effectiveCourtId]);

  /* ═══════════════════════════════════════════════════
     RENDER: Loading & Empty
     ═══════════════════════════════════════════════════ */

  if (rolesLoading || courtsLoading || sessionsLoading) {
    return <CalendarLoadingSkeleton />;
  }

  if (courts.length === 0) {
    return <NoCourtsEmptyState />;
  }

  /* ═══════════════════════════════════════════════════
     Shared header pieces (View-Toggle + Rollen-Aktionen) — von Agenda- UND
     Wochen-/Tagesansicht genutzt, damit beide nicht auseinanderlaufen.
     ═══════════════════════════════════════════════════ */
  const viewToggleEl = (
    <CalendarViewToggle
      viewMode={viewMode}
      setViewMode={setViewMode}
      isAdmin={isAdmin}
      isTrainer={isTrainer}
    />
  );

  const roleActionButtonsEl = (
    <CalendarRoleActions
      isAdmin={isAdmin}
      isTrainer={isTrainer}
      viewMode={viewMode}
      selectedDate={selectedDate}
      selectedCourtId={selectedCourtId}
      courts={courts}
      handleExportICS={handleExportICS}
      openBlockDialog={openBlockDialog}
      openAdHocDialog={openAdHocDialog}
    />
  );

  /* ═══════════════════════════════════════════════════
     RENDER: Agenda View (Tages-Buchungsflow — Standard für alle Rollen)
     Platz-Umschalter + Agenda-Karten statt Wochenzeilen. Ersetzt die frühere
     reine Kartenauswahl-Seite für Member — die übernimmt jetzt der Pillen-Umschalter.
     ═══════════════════════════════════════════════════ */
  if (viewMode === 'agenda') {
    return renderAgendaView();
  }

  /* ═══════════════════════════════════════════════════
     RENDER: Month View (Phase 2.1 — übernommen aus /bookings)
     ═══════════════════════════════════════════════════ */
  if (viewMode === 'month') {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {viewToggleEl}
          {roleActionButtonsEl}
        </div>
        <MonthView
          sessions={visibleSessions}
          isLoading={sessionsLoading}
          currentMonth={selectedDate}
          onPrevMonth={goToPrevious}
          onNextMonth={goToNext}
          onToday={goToToday}
          memberId={memberId}
          clubId={clubId}
          dayOffFor={dayOffFor}
          canManageStatus={isAdmin || isTrainer}
          onBookSession={handleBookSession}
          onCancelBooking={handleCancelBooking}
          onStatusChange={handleStatusChange}
        />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     RENDER: Weekly View
     ═══════════════════════════════════════════════════ */

  // ── Court filtering: single-court mode for members ──
  const displayCourts = effectiveCourtId ? courts.filter((c) => c.id === effectiveCourtId) : courts;

  const weeklyView = (
    <WeekView
      isMobile={isMobile}
      weekDays={weekDays}
      dayOffFor={dayOffFor}
      weekStart={weekStart}
      weekEnd={weekEnd}
      currentWeek={currentWeek}
      setCurrentWeek={setCurrentWeek}
      mobileSelectedDay={mobileSelectedDay}
      setMobileSelectedDay={setMobileSelectedDay}
      displayCourts={displayCourts}
      getPlanEntriesForCourtAndDay={getPlanEntriesForCourtAndDay}
      visibleSessions={visibleSessions}
      sessions={sessions}
      courtClosures={courtClosures}
      openingHours={openingHours}
      isAdmin={isAdmin}
      isTrainer={isTrainer}
      activeId={activeId}
      goToPrevious={goToPrevious}
      goToNext={goToNext}
      openBlockDialog={openBlockDialog}
      handleUnblockSlot={handleUnblockSlot}
      handleRemoveClosure={handleRemoveClosure}
      openAdHocDialog={openAdHocDialog}
      handleBookSlot={handleBookSlot}
      handleCancelBooking={handleCancelBooking}
      handleOpenCancelSession={handleOpenCancelSession}
    />
  );

  /* ═══════════════════════════════════════════════════
     RENDER: Agenda View — Tages-Buchungsflow (Standard für alle Rollen)
     Platz-Umschalter (Pillen) + Agenda-Karten. Statusfarbe ist reserviert und
     läuft nur über einen schmalen Akzentbalken + Icon + ein Label — nie über
     eine volle Kartenfläche (siehe Farb-Review). Klick auf eine freie Karte
     klappt ein rollen-abhängiges Inline-Panel auf statt ein Modal zu öffnen —
     der Kalender bleibt dabei sichtbar.
     ═══════════════════════════════════════════════════ */
  function renderAgendaView() {
    return (
      <AgendaView
        selectedCourtId={selectedCourtId}
        courts={courts}
        selectedDate={selectedDate}
        weekStart={weekStart}
        weekEnd={weekEnd}
        visibleSessions={visibleSessions}
        courtClosures={courtClosures}
        openingHours={openingHours}
        getPlanEntriesForCourtAndDay={getPlanEntriesForNextFree}
        nextFreeSlot={nextFreeSlot}
        isAdmin={isAdmin}
        isTrainer={isTrainer}
        viewToggleEl={viewToggleEl}
        roleActionButtonsEl={roleActionButtonsEl}
        agendaExpandedSlot={agendaExpandedSlot}
        setAgendaExpandedSlot={setAgendaExpandedSlot}
        setSelectedCourtId={setSelectedCourtId}
        setSelectedDate={setSelectedDate}
        goToPrevious={goToPrevious}
        goToNext={goToNext}
        goToToday={goToToday}
        handleBookSlot={handleBookSlot}
        handleCancelBooking={handleCancelBooking}
        handleRemoveClosure={handleRemoveClosure}
        handleUnblockSlot={handleUnblockSlot}
        adHocDialog={adHocDialog}
        blockDialog={blockDialog}
        trainerHourSlotsForDay={trainerHourSlotsForDay}
        onBookTrainerHourSlot={(slot) => bookTrainerHourSlot.mutateAsync(slot)}
        onWaitlistTrainerHourSlot={(slot) => waitlistTrainerHourSlot.mutateAsync(slot)}
        bookTrainerHourSlotLoading={bookTrainerHourSlot.isPending}
        waitlistTrainerHourSlotLoading={waitlistTrainerHourSlot.isPending}
      />
    );
  }

  /* ═══════════════════════════════════════════════════
     RENDER: Daily View — Google-Calendar-Style Time Axis
     (extracted into a function so mobile week view can reuse it)
     ═══════════════════════════════════════════════════ */

  function renderDailyView(targetDate: Date, activeDragId?: string | null) {
    return (
      <DayView
        targetDate={targetDate}
        activeDragId={activeDragId}
        displayCourts={displayCourts}
        getPlanEntriesForCourtAndDay={getPlanEntriesForCourtAndDay}
        visibleSessions={visibleSessions}
        sessions={sessions}
        courtClosures={courtClosures}
        isMobile={isMobile}
        isAdmin={isAdmin}
        isTrainer={isTrainer}
        goToPrevious={goToPrevious}
        goToNext={goToNext}
        handleRemoveClosure={handleRemoveClosure}
        handleBookSlot={handleBookSlot}
        openBlockDialog={openBlockDialog}
        handleUnblockSlot={handleUnblockSlot}
        handleCancelBooking={handleCancelBooking}
        handleOpenCancelSession={handleOpenCancelSession}
        openAdHocDialog={openAdHocDialog}
      />
    );
  }

  /* ═══════════════════════════════════════════════════
     RENDER: Main Layout
     ═══════════════════════════════════════════════════ */

  const calendarContent = (
    <>
      {viewMode === 'weekly' && weeklyView}
      {viewMode === 'daily' && renderDailyView(selectedDate, activeId)}
    </>
  );

  const content = (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Back button to return to court selection cards */}
      {effectiveCourtId && (
        <button
          onClick={() => setSelectedCourtId(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors group/back"
        >
          <ChevronLeft className="h-4 w-4 group-hover/back:-translate-x-0.5 transition-transform" />
          Alle Plätze
        </button>
      )}

      <CourtCalendarHeader
        title={selectedCourt ? selectedCourt.name : 'Platzkalender'}
        subtitle={
          selectedCourt
            ? `${getSurfaceLabel(selectedCourt.surface)}${selectedCourt.hasIndoor ? ' · Indoor' : ''} · ${viewMode === 'weekly' ? 'Wochenansicht' : 'Tagesansicht'}`
            : viewMode === 'weekly'
              ? 'Wochenansicht der Platzverfügbarkeit'
              : viewMode === 'list'
                ? 'Buchungsübersicht — Alle Buchungen auf einen Blick'
                : `Tagesansicht · ${format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })}`
        }
        weekStart={weekStart}
        weekEnd={weekEnd}
        onGoPrevious={goToPrevious}
        onGoNext={goToNext}
        onGoToday={goToToday}
      >
        {/* Platz-Filter (Admin/Trainer) — bei vielen Plätzen auf einen einschränken */}
        {(isAdmin || isTrainer) && courts.length > 1 && (
          <Select
            value={selectedCourtId ?? 'all'}
            onValueChange={(v) => setSelectedCourtId(v === 'all' ? null : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="Alle Plätze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Plätze</SelectItem>
              {courts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View toggle */}
        {viewToggleEl}

        {/* Export + Rollen-Aktionen */}
        {roleActionButtonsEl}
      </CourtCalendarHeader>

      {/* Weather banner (admin only) */}
      {isAdmin && weatherData && <WeatherBanner weatherData={weatherData} />}

      {/* Active closure indicators — für alle Rollen sichtbar (kein Namensleck, nur Grund) */}
      {courtClosures.length > 0 && (
        <ActiveClosuresBanner courtClosures={courtClosures} courts={courts} />
      )}

      {/* Zero-sessions warning (admin view) */}
      {isAdmin && visibleSessions.length === 0 && <ZeroSessionsWarning />}

      {viewMode === 'list' && isAdmin ? (
        <CourtBookingsList clubId={clubId!} isAdmin={isAdmin} />
      ) : (
        <>
          {calendarContent}
          <CourtCalendarLegend items={getCalendarLegendItems(isAdmin)} />
        </>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════
     RENDER: Block Dialog + Trainer Ad-hoc Dialog
     (ausgelagert nach components/block-court-dialog.tsx und
     components/ad-hoc-session-dialog.tsx — Zustand bleibt hier, weil
     dieselben Setter auch vom Inline-Panel weiter oben befüllt werden)
     ═══════════════════════════════════════════════════ */

  const blockDialogEl = (
    <BlockCourtDialog
      open={blockDialog.isOpen}
      onClose={blockDialog.close}
      courtId={blockDialog.courtId}
      courts={courts}
      date={blockDialog.date}
      timeSlot={blockDialog.timeSlot}
      blockType={blockDialog.type}
      onBlockTypeChange={blockDialog.setType}
      weatherData={weatherData}
      duration={blockDialog.duration}
      onDurationChange={blockDialog.setDuration}
      reason={blockDialog.reason}
      onReasonChange={blockDialog.setReason}
      onSubmit={blockDialog.submit}
      loading={blockDialog.loading}
    />
  );

  const adHocDialogEl = (
    <AdHocSessionDialog
      open={adHocDialog.isOpen}
      onClose={adHocDialog.close}
      courtId={adHocDialog.courtId}
      courts={courts}
      date={adHocDialog.date}
      timeSlot={adHocDialog.timeSlot}
      duration={adHocDialog.duration}
      onDurationChange={adHocDialog.setDuration}
      maxParticipants={adHocDialog.maxParticipants}
      onMaxParticipantsChange={adHocDialog.setMaxParticipants}
      notes={adHocDialog.notes}
      onNotesChange={adHocDialog.setNotes}
      onSubmit={adHocDialog.submit}
      loading={adHocDialog.loading}
    />
  );

  const sessionCancelDialogEl = sessionCancelDialog.dialog;

  /* ═══════════════════════════════════════════════════
     RENDER: Wrap with DnD for admins
     ═══════════════════════════════════════════════════ */

  // Wrap all content in a single TooltipProvider (avoids per-slot overhead)
  const wrappedContent = isAdmin ? (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {content}
        <DragOverlay>
          {activeId && draggedSession ? (
            <DraggableSessionCard session={draggedSession} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
      {blockDialogEl}
      {adHocDialogEl}
      {sessionCancelDialogEl}
      {confirmDialog}
      <BookingConfirmDialog {...bookingDialog} clubId={clubId} memberId={memberId} />
    </>
  ) : (
    <>
      {content}
      {blockDialogEl}
      {adHocDialogEl}
      {sessionCancelDialogEl}
      {confirmDialog}
      <BookingConfirmDialog {...bookingDialog} clubId={clubId} memberId={memberId} />
    </>
  );

  return <TooltipProvider delayDuration={200}>{wrappedContent}</TooltipProvider>;
}
