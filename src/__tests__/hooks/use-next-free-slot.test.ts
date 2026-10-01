import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNextFreeSlot } from '@/hooks/use-next-free-slot';
import type { PlanEntry } from '@/components/calendar/types';

// Dienstagstraining (API-Wochentag 1 = Dienstag) auf Platz 1.
const entry: PlanEntry = {
  id: 'p1',
  group_id: 'g1',
  group_name: 'Jugend',
  group_color: '#000',
  trainer_id: 't1',
  court_id: 'c1',
  day_of_week: 1,
  start_time: '14:00',
  end_time: '15:30',
};

describe('useNextFreeSlot — Saisonplan im Kalender', () => {
  it('blendet Training in Ferien/an Feiertagen aus, sonst nicht', () => {
    const { result } = renderHook(() =>
      useNextFreeSlot({
        visiblePlanSlots: [entry],
        courts: [{ id: 'c1', name: 'Platz 1' }],
        visibleSessions: [],
        courtClosures: [],
        openingHours: null,
        dayOffFor: (d) => (d.getDate() === 20 ? { name: 'Herbstferien', kind: 'school' } : null),
      })
    );
    const get = result.current.getPlanEntriesForCourtAndDay;
    expect(get('c1', new Date(2026, 8, 29))).toEqual([entry]); // Di, normal
    expect(get('c1', new Date(2026, 9, 20))).toEqual([]); // Di, Herbstferien
    expect(get('c1', new Date(2026, 8, 30))).toEqual([]); // Mi, kein Training
  });
});
