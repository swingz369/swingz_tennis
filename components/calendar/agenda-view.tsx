'use client';

/**
 * Agenda-Ansicht des Platzkalenders — Tages-Buchungsflow (Standard für alle
 * Rollen). Platz-Umschalter (Pillen) + Agenda-Karten. Statusfarbe ist
 * reserviert und läuft nur über einen schmalen Akzentbalken + Icon + ein
 * Label — nie über eine volle Kartenfläche (siehe Farb-Review). Klick auf
 * eine freie Karte klappt ein rollen-abhängiges Inline-Panel auf statt ein
 * Modal zu öffnen — der Kalender bleibt dabei sichtbar.
 *
 * Ausgelagert aus unified-court-calendar.tsx (Sanierungsplan Phase 2.2).
 */
import type { ReactNode } from 'react';
import { format, isSameDay, getDay as dateFnsGetDay } from 'date-fns';
import { de } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChevronRight, Lock, Plus, Search, User, Users, X } from 'lucide-react';
import type { Session } from '@/hooks/use-sessions';
import type { TrainerHourSlot } from '@/hooks/use-trainer-hour-slots';
import type { PlanEntry } from '@/components/calendar/types';
import {
  CALENDAR_TIME_SLOTS as TIME_SLOTS,
  getSlotStatus,
  getCalendarLegendItems,
  type CourtClosure,
} from '@/lib/court-calendar-utils';
import { CourtCalendarHeader, CourtCalendarLegend } from '@/components/court-calendar-shared';
import { TrainerHourSlotsSection } from '@/components/calendar/trainer-hour-slots';
import { REASON_LABEL_SHORT } from '@/components/calendar/calendar-primitives';
import type { BlockCourtDialogState } from '@/hooks/use-block-court-dialog';
import type { AdHocSessionDialogState } from '@/hooks/use-ad-hoc-session-dialog';

export interface AgendaViewProps {
  selectedCourtId: string | null;
  courts: { id: string; name: string }[];
  selectedDate: Date;
  weekStart: Date;
  weekEnd: Date;
  visibleSessions: Session[];
  courtClosures: CourtClosure[];
  openingHours: unknown;
  getPlanEntriesForCourtAndDay: (
    courtId: string,
    dayOfWeek: number
  ) => (PlanEntry & { court_id: string })[];
  nextFreeSlot: { courtId: string; courtName: string; date: Date; timeSlot: string } | null;
  isAdmin: boolean;
  isTrainer: boolean;
  viewToggleEl: ReactNode;
  roleActionButtonsEl: ReactNode;
  agendaExpandedSlot: string | null;
  setAgendaExpandedSlot: (slot: string | null) => void;
  setSelectedCourtId: (courtId: string | null) => void;
  setSelectedDate: (date: Date) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToToday: () => void;
  handleBookSlot: (courtId: string, date: Date, timeSlot: string) => void;
  handleCancelBooking: (sessionId: string, bookingId: string) => void;
  handleRemoveClosure: (closureId: string) => void;
  handleUnblockSlot: (sessionId: string) => void;
  // Ad-hoc- und Block-Dialoge — dasselbe Feld-Set wie das jeweilige Modal
  // (Wochen-/Tagesansicht), hier zusätzlich fürs Inline-Panel genutzt.
  adHocDialog: AdHocSessionDialogState;
  blockDialog: BlockCourtDialogState;
  // Trainerstunden (vierte Slot-Quelle)
  trainerHourSlotsForDay: TrainerHourSlot[];
  onBookTrainerHourSlot: (slot: TrainerHourSlot) => Promise<unknown>;
  onWaitlistTrainerHourSlot: (slot: TrainerHourSlot) => Promise<unknown>;
  bookTrainerHourSlotLoading: boolean;
  waitlistTrainerHourSlotLoading: boolean;
}

export function AgendaView({
  selectedCourtId,
  courts,
  selectedDate,
  weekStart,
  weekEnd,
  visibleSessions,
  courtClosures,
  openingHours,
  getPlanEntriesForCourtAndDay,
  nextFreeSlot,
  isAdmin,
  isTrainer,
  viewToggleEl,
  roleActionButtonsEl,
  agendaExpandedSlot,
  setAgendaExpandedSlot,
  setSelectedCourtId,
  setSelectedDate,
  goToPrevious,
  goToNext,
  goToToday,
  handleBookSlot,
  handleCancelBooking,
  handleRemoveClosure,
  handleUnblockSlot,
  adHocDialog,
  blockDialog,
  trainerHourSlotsForDay,
  onBookTrainerHourSlot,
  onWaitlistTrainerHourSlot,
  bookTrainerHourSlotLoading,
  waitlistTrainerHourSlotLoading,
}: AgendaViewProps) {
  const activeCourtId = selectedCourtId ?? courts[0]?.id ?? null;
  const activeCourt = activeCourtId ? (courts.find((c) => c.id === activeCourtId) ?? null) : null;
  const planEntriesForDay = activeCourtId
    ? getPlanEntriesForCourtAndDay(activeCourtId, dateFnsGetDay(selectedDate))
    : [];
  const isToday = isSameDay(selectedDate, new Date());
  const nextFreeLabel =
    nextFreeSlot &&
    `${isSameDay(nextFreeSlot.date, new Date()) ? 'Heute' : format(nextFreeSlot.date, 'EEEE', { locale: de })} ${nextFreeSlot.timeSlot} Uhr · ${nextFreeSlot.courtName}`;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CourtCalendarHeader
        title="Heute"
        subtitle={`${format(selectedDate, 'EEEE, dd. MMMM yyyy', { locale: de })}${activeCourt ? ' · ' + activeCourt.name : ''}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onGoPrevious={goToPrevious}
        onGoNext={goToNext}
        onGoToday={goToToday}
      >
        {viewToggleEl}
        {roleActionButtonsEl}
      </CourtCalendarHeader>

      {/* Platz-Umschalter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {courts.map((court) => (
          <button
            key={court.id}
            onClick={() => {
              setSelectedCourtId(court.id);
              setAgendaExpandedSlot(null);
            }}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              court.id === activeCourtId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {court.name}
          </button>
        ))}
      </div>

      {/* Nächster freier Platz */}
      {nextFreeSlot && nextFreeLabel && (
        <button
          onClick={() => {
            setSelectedCourtId(nextFreeSlot.courtId);
            setSelectedDate(nextFreeSlot.date);
            setAgendaExpandedSlot(nextFreeSlot.timeSlot);
          }}
          className="w-full flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] hover:bg-primary/[0.1] transition-colors px-4 py-3 text-left"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary flex-shrink-0">
            <Search className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground">Nächster freier Platz</div>
            <div className="text-xs text-muted-foreground">{nextFreeLabel}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
        </button>
      )}

      {/* Agenda-Liste */}
      {activeCourtId && (
        <div className="flex flex-col gap-2">
          {TIME_SLOTS.map((timeSlot, timeIdx) => {
            const { status, session, closure, closedDay } = getSlotStatus(
              activeCourtId,
              selectedDate,
              timeSlot,
              visibleSessions,
              planEntriesForDay,
              courtClosures,
              openingHours
            );
            const [slotH, slotM] = timeSlot.split(':').map(Number);
            const isPast =
              isToday &&
              new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
                slotH,
                slotM
              ) < new Date();
            const isExpanded = agendaExpandedSlot === timeSlot;
            const isMember = !isAdmin && !isTrainer;

            // Mitglieder dürfen auch eine bereits geplante, noch offene Session antippen
            // (status "session" = Trainingszeit ohne Buchung) — nicht nur leere Slots.
            const canAct =
              !isPast && (status === 'available' || (status === 'session' && isMember));
            const canOwnCancel = status === 'own-booking' && session?.bookingId;
            const canAdminUnblock = isAdmin && status === 'blocked' && !closedDay;

            let bar = '';
            let icon = <Plus className="h-3.5 w-3.5" />;
            let label = 'Frei';
            let meta = '';
            let cardClass = 'border-dashed border-border text-muted-foreground bg-transparent';

            if (status === 'session') {
              bar = 'bg-info-500';
              icon = <User className="h-3.5 w-3.5 text-info-500" />;
              label = session?.trainerName || 'Offene Session';
              const free = Math.max(
                0,
                (session?.maxParticipants ?? 0) - (session?.currentBookings ?? 0)
              );
              meta = `${free} frei`;
              cardClass = 'border-border bg-card';
            } else if (status === 'booked') {
              bar = 'bg-gray-500';
              icon = <Lock className="h-3.5 w-3.5 text-gray-500" />;
              label = 'Belegt';
              meta = `${session?.currentBookings ?? 0}/${session?.maxParticipants ?? 0}`;
              cardClass = 'border-border bg-card';
            } else if (status === 'own-booking') {
              bar = 'bg-brand-light';
              icon = <div className="w-2.5 h-2.5 rounded-full bg-brand-light" />;
              label = 'Deine Buchung';
              meta = `${session?.startTime ?? timeSlot}–${session?.endTime ?? ''}`;
              cardClass = 'border-brand-light/30 bg-card';
            } else if (status === 'blocked') {
              bar = 'bg-gray-700';
              icon = <Lock className="h-3.5 w-3.5 text-gray-600" />;
              label = closedDay
                ? 'Geschlossen'
                : isAdmin
                  ? closure
                    ? closure.description || REASON_LABEL_SHORT[closure.reason] || closure.reason
                    : session?.notes ||
                      (session?.sessionType === 'maintenance' ? 'Wartung' : 'Event')
                  : 'Gesperrt';
              cardClass = 'border-border bg-muted/40 text-muted-foreground';
            } else if (status === 'plan') {
              bar = 'bg-info-300';
              icon = <Users className="h-3.5 w-3.5 text-info-400" />;
              label = 'Gruppentraining';
              cardClass = 'border-dashed border-info-200 bg-info-50/40 text-info-700';
            } else if (isPast) {
              cardClass = 'border-border bg-transparent text-muted-foreground/60';
              label = 'Vorbei';
            }

            const clickable = canAct || canOwnCancel || canAdminUnblock;

            const activateCard = () => {
              if (canAct) {
                if (isMember) setAgendaExpandedSlot(isExpanded ? null : timeSlot);
                else if (isTrainer) {
                  adHocDialog.setTarget(activeCourtId, selectedDate, timeSlot);
                  setAgendaExpandedSlot(isExpanded ? null : timeSlot);
                } else if (isAdmin) {
                  blockDialog.setTarget(activeCourtId, selectedDate, timeSlot);
                  setAgendaExpandedSlot(isExpanded ? null : timeSlot);
                }
              } else if (canOwnCancel && session) {
                handleCancelBooking(session.id, session.bookingId!);
              } else if (canAdminUnblock) {
                if (closure) handleRemoveClosure(closure.id);
                else if (session) handleUnblockSlot(session.id);
              }
            };

            return (
              <div key={timeSlot}>
                <div
                  id={`agenda-slot-${timeSlot}`}
                  className={`relative flex items-center gap-3 rounded-xl border pl-4 pr-3 py-2.5 transition-colors ${cardClass} ${
                    clickable ? 'cursor-pointer hover:shadow-sm' : ''
                  }`}
                  role="button"
                  tabIndex={clickable ? 0 : -1}
                  onClick={clickable ? activateCard : undefined}
                  onKeyDown={(e) => {
                    // Pfeiltasten bewegen die Auswahl zwischen Zeit-Slots, Escape
                    // schließt das aufgeklappte Inline-Panel (Sanierungsplan Phase 5.2).
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      const nextIdx = e.key === 'ArrowUp' ? timeIdx - 1 : timeIdx + 1;
                      if (nextIdx < 0 || nextIdx >= TIME_SLOTS.length) return;
                      document.getElementById(`agenda-slot-${TIME_SLOTS[nextIdx]}`)?.focus();
                      return;
                    }
                    if (e.key === 'Escape' && isExpanded) {
                      e.preventDefault();
                      setAgendaExpandedSlot(null);
                      return;
                    }
                    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      activateCard();
                    }
                  }}
                >
                  {bar && (
                    <span
                      className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${bar}`}
                    />
                  )}
                  <span className="w-11 flex-shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                    {timeSlot}
                  </span>
                  {icon}
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate">{label}</span>
                  {meta && (
                    <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                      {meta}
                    </span>
                  )}
                  {canOwnCancel && <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </div>

                {/* Inline-Panel — Kalender bleibt sichtbar, kein Modal */}
                {isExpanded && (status === 'available' || (status === 'session' && isMember)) && (
                  <div className="mt-1.5 ml-4 mr-3 rounded-xl border border-border bg-muted/30 p-3">
                    {isMember && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground">
                          Platz {activeCourt?.name} um {timeSlot} Uhr buchen?
                        </span>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAgendaExpandedSlot(null)}
                          >
                            Abbrechen
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              handleBookSlot(activeCourtId, selectedDate, timeSlot);
                              setAgendaExpandedSlot(null);
                            }}
                          >
                            Jetzt buchen
                          </Button>
                        </div>
                      </div>
                    )}
                    {isTrainer && !isAdmin && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs shrink-0">Dauer</Label>
                          {[1, 2, 3, 4].map((h) => (
                            <Button
                              key={h}
                              type="button"
                              size="sm"
                              variant={adHocDialog.duration === h ? 'default' : 'outline'}
                              className="h-7 px-2.5 text-xs"
                              onClick={() => adHocDialog.setDuration(h)}
                            >
                              {h}h
                            </Button>
                          ))}
                        </div>
                        <Input
                          placeholder="Notiz (optional)"
                          value={adHocDialog.notes}
                          onChange={(e) => adHocDialog.setNotes(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAgendaExpandedSlot(null)}
                          >
                            Abbrechen
                          </Button>
                          <Button
                            size="sm"
                            disabled={adHocDialog.loading}
                            onClick={adHocDialog.submit}
                          >
                            {adHocDialog.loading ? 'Wird eingetragen...' : 'Eintragen'}
                          </Button>
                        </div>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(['event', 'maintenance', 'weather'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => blockDialog.setType(t)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                blockDialog.type === t
                                  ? 'bg-gray-700 text-white border-gray-700'
                                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
                              }`}
                            >
                              {t === 'event' ? 'Event' : t === 'maintenance' ? 'Wartung' : 'Wetter'}
                            </button>
                          ))}
                          {[1, 2, 3, 4].map((h) => (
                            <Button
                              key={h}
                              type="button"
                              size="sm"
                              variant={blockDialog.duration === h ? 'default' : 'outline'}
                              className="h-7 px-2.5 text-xs"
                              onClick={() => blockDialog.setDuration(h)}
                            >
                              {h}h
                            </Button>
                          ))}
                        </div>
                        <Input
                          placeholder="Grund (optional)"
                          value={blockDialog.reason}
                          onChange={(e) => blockDialog.setReason(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAgendaExpandedSlot(null)}
                          >
                            Abbrechen
                          </Button>
                          <Button
                            size="sm"
                            disabled={blockDialog.loading}
                            onClick={blockDialog.submit}
                          >
                            {blockDialog.loading ? 'Wird gesperrt...' : 'Sperren'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CourtCalendarLegend items={getCalendarLegendItems(isAdmin)} />

      <TrainerHourSlotsSection
        slots={trainerHourSlotsForDay}
        isMember={!isAdmin && !isTrainer}
        onBook={onBookTrainerHourSlot}
        onWaitlist={onWaitlistTrainerHourSlot}
        bookLoading={bookTrainerHourSlotLoading}
        waitlistLoading={waitlistTrainerHourSlotLoading}
      />
    </div>
  );
}
