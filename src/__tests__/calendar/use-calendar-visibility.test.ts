/**
 * Rollenbasierte Sichtbarkeit im Platzkalender — Sanierungsplan Phase 2.2:
 * "die sicherheitsrelevanteste Stelle... gehört testbar isoliert."
 * Admin sieht alles, Trainer sieht nur eigene Sessions/Planeinträge, Mitglied
 * sieht nur seine Gruppen plus eigene Buchungen.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarVisibility } from '@/hooks/use-calendar-visibility';
import type { Session } from '@/hooks/use-sessions';
import type { PlanEntry } from '@/components/calendar/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    dayOfWeek: 1,
    startTime: '17:00',
    endTime: '18:00',
    trainerId: 'trainer-a',
    groupIds: ['group-a'],
    maxParticipants: 6,
    bookedByUser: false,
    ...overrides,
  };
}

function makePlanEntry(overrides: Partial<PlanEntry> = {}): PlanEntry {
  return {
    id: 'p1',
    group_id: 'group-a',
    group_name: 'Gruppe A',
    group_color: '#000',
    trainer_id: 'trainer-a',
    court_id: 'court-1',
    day_of_week: 1,
    start_time: '17:00',
    end_time: '18:00',
    ...overrides,
  };
}

describe('useCalendarVisibility', () => {
  const sessions: Session[] = [
    makeSession({ id: 's-group-a', trainerId: 'trainer-a', groupIds: ['group-a'] }),
    makeSession({ id: 's-group-b', trainerId: 'trainer-b', groupIds: ['group-b'] }),
    makeSession({
      id: 's-own-booking-other-group',
      trainerId: 'trainer-b',
      groupIds: ['group-b'],
      bookedByUser: true,
    }),
    makeSession({ id: 's-open', trainerId: 'trainer-a', groupIds: [] }),
  ];

  const planSlots: PlanEntry[] = [
    makePlanEntry({ id: 'p-group-a', trainer_id: 'trainer-a', group_id: 'group-a' }),
    makePlanEntry({ id: 'p-group-b', trainer_id: 'trainer-b', group_id: 'group-b' }),
  ];

  it('admin sieht alle Sessions und Planeinträge', () => {
    const { result } = renderHook(() =>
      useCalendarVisibility({
        sessions,
        planSlots,
        isAdmin: true,
        isTrainer: false,
        trainerRecordId: null,
        memberGroupIds: [],
      })
    );

    expect(result.current.visibleSessions).toHaveLength(4);
    expect(result.current.visiblePlanSlots).toHaveLength(2);
  });

  it('trainer sieht nur eigene Sessions und Planeinträge', () => {
    const { result } = renderHook(() =>
      useCalendarVisibility({
        sessions,
        planSlots,
        isAdmin: false,
        isTrainer: true,
        trainerRecordId: 'trainer-a',
        memberGroupIds: [],
      })
    );

    expect(result.current.visibleSessions.map((s) => s.id)).toEqual(['s-group-a', 's-open']);
    expect(result.current.visiblePlanSlots.map((p) => p.id)).toEqual(['p-group-a']);
  });

  it('mitglied ohne Gruppen sieht nur eigene Buchungen und offene Sessions, keine Planeinträge', () => {
    const { result } = renderHook(() =>
      useCalendarVisibility({
        sessions,
        planSlots,
        isAdmin: false,
        isTrainer: false,
        trainerRecordId: null,
        memberGroupIds: [],
      })
    );

    expect(result.current.visibleSessions.map((s) => s.id)).toEqual([
      's-own-booking-other-group',
      's-open',
    ]);
    expect(result.current.visiblePlanSlots).toHaveLength(0);
  });

  it('mitglied mit Gruppe sieht Gruppen-Sessions, eigene Buchungen und offene Sessions — nicht die fremde Gruppe', () => {
    const { result } = renderHook(() =>
      useCalendarVisibility({
        sessions,
        planSlots,
        isAdmin: false,
        isTrainer: false,
        trainerRecordId: null,
        memberGroupIds: ['group-a'],
      })
    );

    expect(result.current.visibleSessions.map((s) => s.id)).toEqual([
      's-group-a',
      's-own-booking-other-group',
      's-open',
    ]);
    expect(result.current.visiblePlanSlots.map((p) => p.id)).toEqual(['p-group-a']);
  });
});
