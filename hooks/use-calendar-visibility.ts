import { useMemo } from 'react';
import type { Session } from '@/hooks/use-sessions';
import type { PlanEntry } from '@/components/calendar/types';

/**
 * Rollenbasierte Sichtbarkeit im Platzkalender — Admin sieht alles, Trainer
 * sieht seine eigenen Sessions/Planeinträge, Mitglied sieht seine Gruppen plus
 * eigene Buchungen. Aus unified-court-calendar.tsx ausgelagert (Sanierungsplan
 * Phase 2.2): „die sicherheitsrelevanteste Stelle... gehört testbar isoliert"
 * — siehe use-calendar-visibility.test.ts.
 */
export function useCalendarVisibility({
  sessions,
  planSlots,
  isAdmin,
  isTrainer,
  trainerRecordId,
  memberGroupIds,
}: {
  sessions: Session[];
  planSlots: PlanEntry[];
  isAdmin: boolean;
  isTrainer: boolean;
  trainerRecordId: string | null;
  memberGroupIds: string[];
}) {
  const visibleSessions = useMemo(() => {
    if (isAdmin) return sessions;
    if (isTrainer && trainerRecordId)
      return sessions.filter((s) => s.trainerId === trainerRecordId);
    if (memberGroupIds.length === 0) {
      // Keine Gruppenmitgliedschaft → nur eigene Buchungen + offene Sessions (ohne groupIds)
      return sessions.filter((s) => s.bookedByUser || !s.groupIds || s.groupIds.length === 0);
    }
    const groupSet = new Set(memberGroupIds);
    return sessions.filter((s) => {
      if (s.bookedByUser) return true;
      if (!s.groupIds || s.groupIds.length === 0) return true;
      return s.groupIds.some((gid) => groupSet.has(gid));
    });
  }, [sessions, isAdmin, isTrainer, trainerRecordId, memberGroupIds]);

  const visiblePlanSlots = useMemo(() => {
    if (isAdmin) return planSlots;
    if (isTrainer && trainerRecordId)
      return planSlots.filter((e) => e.trainer_id === trainerRecordId);
    if (memberGroupIds.length === 0) return [];
    const groupSet = new Set(memberGroupIds);
    return planSlots.filter((e) => e.group_id && groupSet.has(e.group_id));
  }, [planSlots, isAdmin, isTrainer, trainerRecordId, memberGroupIds]);

  return { visibleSessions, visiblePlanSlots };
}
