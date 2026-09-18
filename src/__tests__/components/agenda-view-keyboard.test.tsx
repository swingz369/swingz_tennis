import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render } from '../test-utils';
import { AgendaView } from '@/components/calendar/agenda-view';

/**
 * Sanierungsplan Phase 5.2 — Escape schließt das aufgeklappte Inline-Panel
 * der Agenda-Ansicht, Pfeiltasten wechseln zwischen Zeit-Slots.
 */
describe('AgendaView keyboard navigation', () => {
  const selectedDate = new Date(2026, 8, 14);

  const blockDialog = {
    isOpen: false,
    courtId: '',
    date: selectedDate,
    timeSlot: '',
    type: 'event' as const,
    reason: '',
    duration: 60,
    loading: false,
    setTarget: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    setType: vi.fn(),
    setReason: vi.fn(),
    setDuration: vi.fn(),
    submit: vi.fn(),
  };

  const adHocDialog = {
    isOpen: false,
    courtId: '',
    date: selectedDate,
    timeSlot: '',
    duration: 60,
    maxParticipants: 4,
    notes: '',
    loading: false,
    setTarget: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    setDuration: vi.fn(),
    setMaxParticipants: vi.fn(),
    setNotes: vi.fn(),
    submit: vi.fn(),
  };

  const baseProps = {
    selectedCourtId: 'court-1',
    courts: [{ id: 'court-1', name: 'Platz 1' }],
    selectedDate,
    weekStart: selectedDate,
    weekEnd: selectedDate,
    visibleSessions: [],
    courtClosures: [],
    openingHours: null,
    getPlanEntriesForCourtAndDay: () => [],
    nextFreeSlot: null,
    isAdmin: false,
    isTrainer: false,
    viewToggleEl: null,
    roleActionButtonsEl: null,
    setSelectedCourtId: vi.fn(),
    setSelectedDate: vi.fn(),
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    goToToday: vi.fn(),
    handleBookSlot: vi.fn(),
    handleCancelBooking: vi.fn(),
    handleRemoveClosure: vi.fn(),
    handleUnblockSlot: vi.fn(),
    adHocDialog,
    blockDialog,
    trainerHourSlotsForDay: [],
    onBookTrainerHourSlot: vi.fn(),
    onWaitlistTrainerHourSlot: vi.fn(),
    bookTrainerHourSlotLoading: false,
    waitlistTrainerHourSlotLoading: false,
  };

  it('Escape closes the expanded inline panel', () => {
    const setAgendaExpandedSlot = vi.fn();
    render(
      <AgendaView
        {...baseProps}
        agendaExpandedSlot="08:00"
        setAgendaExpandedSlot={setAgendaExpandedSlot}
      />
    );

    const row = document.getElementById('agenda-slot-08:00');
    expect(row).not.toBeNull();
    fireEvent.keyDown(row!, { key: 'Escape' });
    expect(setAgendaExpandedSlot).toHaveBeenCalledWith(null);
  });

  it('ArrowDown moves focus to the next time slot', () => {
    render(<AgendaView {...baseProps} agendaExpandedSlot={null} setAgendaExpandedSlot={vi.fn()} />);

    const first = document.getElementById('agenda-slot-08:00');
    first!.focus();
    fireEvent.keyDown(first!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(document.getElementById('agenda-slot-09:00'));
  });
});
