import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render } from '../test-utils';
import { WeekView } from '@/components/calendar/week-view';

/**
 * Sanierungsplan Phase 5.2 — Pfeiltasten-Navigation im Wochenraster.
 * Regressionsschutz für die Zell-IDs + Fokuswechsel-Logik in week-view.tsx.
 */
describe('WeekView keyboard navigation', () => {
  const weekStart = new Date(2026, 8, 14); // Montag, 14.09.2026
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const baseProps = {
    isMobile: false,
    weekDays,
    weekStart,
    weekEnd: weekDays[6],
    currentWeek: weekStart,
    setCurrentWeek: vi.fn(),
    mobileSelectedDay: weekDays[0],
    setMobileSelectedDay: vi.fn(),
    displayCourts: [{ id: 'court-1', name: 'Platz 1', surface: 'hard' }],
    getPlanEntriesForCourtAndDay: () => [],
    visibleSessions: [],
    sessions: [],
    courtClosures: [],
    openingHours: null,
    isAdmin: false,
    isTrainer: false,
    activeId: null,
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    openBlockDialog: vi.fn(),
    handleUnblockSlot: vi.fn(),
    handleRemoveClosure: vi.fn(),
    openAdHocDialog: vi.fn(),
    handleBookSlot: vi.fn(),
    handleCancelBooking: vi.fn(),
    handleOpenCancelSession: vi.fn(),
  };

  it('ArrowDown moves focus to the next time slot, ArrowRight to the next day', () => {
    render(<WeekView {...baseProps} />);

    const first = document.getElementById('wv-slot-court-1-2026-09-14-08:00');
    expect(first).not.toBeNull();
    first!.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first!, { key: 'ArrowDown' });
    const nextTime = document.getElementById('wv-slot-court-1-2026-09-14-09:00');
    expect(document.activeElement).toBe(nextTime);

    fireEvent.keyDown(nextTime!, { key: 'ArrowRight' });
    const nextDay = document.getElementById('wv-slot-court-1-2026-09-15-09:00');
    expect(document.activeElement).toBe(nextDay);
  });

  it('does not move focus past the grid edges', () => {
    render(<WeekView {...baseProps} />);
    const first = document.getElementById('wv-slot-court-1-2026-09-14-08:00');
    first!.focus();
    fireEvent.keyDown(first!, { key: 'ArrowUp' });
    fireEvent.keyDown(first!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
  });

  it('Enter on an available slot books it', () => {
    const handleBookSlot = vi.fn();
    render(<WeekView {...baseProps} handleBookSlot={handleBookSlot} />);
    const first = document.getElementById('wv-slot-court-1-2026-09-14-08:00');
    first!.focus();
    fireEvent.keyDown(first!, { key: 'Enter' });
    expect(handleBookSlot).toHaveBeenCalledWith('court-1', weekDays[0], '08:00');
  });
});
