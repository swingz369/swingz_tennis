import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api-fetch';
import { isDateInHolidays, type Holiday } from '@/lib/season-planning/holidays';

export interface DayOff {
  name: string;
  kind: 'school' | 'public';
}

/** Schulferien + Feiertage des Vereins-Bundeslands. `dayOffFor(date)` → Feiertag vor Ferien. */
export function useHolidays(clubId: string | null) {
  const [school, setSchool] = useState<Holiday[]>([]);
  const [publicDays, setPublicDays] = useState<Holiday[]>([]);

  useEffect(() => {
    if (!clubId) return;
    apiFetch('/api/holidays')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSchool(data.school ?? []);
        setPublicDays(data.public ?? []);
      })
      .catch(() => {
        /* rein informativ */
      });
  }, [clubId]);

  return useCallback(
    (date: Date): DayOff | null => {
      const iso = format(date, 'yyyy-MM-dd');
      const p = publicDays.find((h) => isDateInHolidays(iso, [h]));
      if (p) return { name: p.name, kind: 'public' };
      const s = school.find((h) => isDateInHolidays(iso, [h]));
      return s ? { name: s.name, kind: 'school' } : null;
    },
    [school, publicDays]
  );
}
