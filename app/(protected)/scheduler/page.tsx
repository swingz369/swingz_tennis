'use client';

import { useMemo } from 'react';
import { Clock, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useSessions, type Session } from '@/hooks/use-sessions';
import { useUserRoles, useUserClub } from '@/hooks/use-user-data';
import { useCurrentUser } from '@/hooks/use-current-user';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

const TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function SchedulerPage() {
  const { data: clubData } = useUserClub();
  const clubId = clubData?.clubId ?? null;

  const { data: allSessions = [], isLoading, error } = useSessions(clubId);
  const { data: user } = useCurrentUser();
  const { data: roles = [] } = useUserRoles();

  const isAdmin = roles.includes('admin') || roles.includes('superadmin');
  const isTrainer = roles.includes('trainer');
  const isMember = !isAdmin && !isTrainer;

  const subtitle = isAdmin
    ? 'Wochenstundenplan — alle Trainingsgruppen'
    : isTrainer
      ? 'Deine zugewiesenen Trainingseinheiten'
      : 'Dein Trainingsplan · Gebuchte Sessions sind markiert';

  // For the grid: deduplicate by dayOfWeek+startTime — one representative card per slot
  // Pick the next upcoming session for each slot as representative
  const slotMap = useMemo(() => {
    const now = new Date();
    const map = new Map<string, Session>();
    // Sort ascending so we pick the soonest upcoming session per slot
    const sorted = [...allSessions].sort((a, b) =>
      (a.timeslotStart ?? '').localeCompare(b.timeslotStart ?? '')
    );
    for (const s of sorted) {
      const key = `${s.dayOfWeek}-${s.startTime}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, s);
      } else {
        // Prefer upcoming over past
        const sDate = s.timeslotStart ? new Date(s.timeslotStart) : null;
        const existDate = existing.timeslotStart ? new Date(existing.timeslotStart) : null;
        if (sDate && sDate >= now && (!existDate || existDate < now)) {
          map.set(key, s);
        }
      }
    }
    return map;
  }, [allSessions]);

  const getSessionsForSlot = (dayIdx: number, time: string): Session[] => {
    // dayIdx 0=Mo ... 6=So → API dayOfWeek 1=Mo ... 7=So
    const dayOfWeek = dayIdx + 1;
    const s = slotMap.get(`${dayOfWeek}-${time}`);
    return s ? [s] : [];
  };

  const handleOptimize = async () => {
    if (!clubId) return;
    try {
      await apiFetch('/api/schedule/optimize', {
        method: 'POST',
        body: JSON.stringify({ clubId }),
      });
      toast.success('Stundenplan optimiert');
    } catch {
      toast.error('Optimierung fehlgeschlagen');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (error || allSessions.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <CalendarShell title="Stundenplan" subtitle={subtitle} />
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <Clock className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-brand-primary">Noch kein Stundenplan vorhanden</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Der Stundenplan wird nach der Saisonplanung vom Administrator veröffentlicht.
          </p>
        </div>
      </div>
    );
  }

  // Sessions shown in the list below the grid
  const listSessions: Session[] = isMember
    ? allSessions.filter((s: Session) => s.bookedByUser)
    : isTrainer && user?.userId
      ? allSessions.filter((s: Session) => s.trainerId === user.userId)
      : allSessions;

  return (
    <div className="p-6 space-y-6">
      <CalendarShell
        title="Stundenplan"
        subtitle={subtitle}
        controls={
          isAdmin ? (
            <Button onClick={handleOptimize} variant="accent" className="flex items-center gap-2">
              <Sparkles size={16} />
              KI-Optimierung
            </Button>
          ) : undefined
        }
      />

      {/* Weekly template grid */}
      <Card variant="elevated" padding="none" className="overflow-x-auto">
        <div className="min-w-[768px]">
          {/* Header: days */}
          <div className="grid grid-cols-8 border-b border-border bg-muted">
            <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border">
              Uhrzeit
            </div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="p-3 text-sm font-semibold text-center text-brand-primary border-r border-border last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Time rows */}
          {TIME_SLOTS.map((time) => (
            <div key={time} className="grid grid-cols-8 border-b border-border last:border-b-0">
              <div className="p-2 text-sm text-muted-foreground border-r border-border text-center bg-muted">
                {time}
              </div>
              {DAYS.map((_, dayIdx) => {
                const sessions = getSessionsForSlot(dayIdx, time);
                return (
                  <div
                    key={dayIdx}
                    className="min-h-[60px] border-r border-border last:border-r-0 p-1.5 hover:bg-muted/50"
                  >
                    {sessions.map((s) => (
                      <SessionSlotCard key={s.id} session={s} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Session list */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-brand-primary">
          {isMember ? 'Meine gebuchten Sessions' : isTrainer ? 'Meine Einheiten' : 'Alle Sessions'}
        </h3>

        {listSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {isMember ? 'Du hast noch keine Sessions gebucht.' : 'Keine Sessions gefunden.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listSessions.slice(0, 30).map((session: Session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact card shown inside the grid slot */
function SessionSlotCard({ session }: { session: Session }) {
  return (
    <div
      className={`p-1.5 rounded text-xs border ${
        session.bookedByUser
          ? 'bg-brand-light/15 border-brand-light/40 text-brand-light'
          : 'bg-blue-50 border-blue-200 text-blue-800'
      }`}
    >
      <div className="font-medium truncate">{session.trainerName || 'Trainer'}</div>
      <div className="text-[10px] text-muted-foreground">
        {session.startTime}–{session.endTime}
      </div>
      {session.bookedByUser && <div className="w-1.5 h-1.5 rounded-full bg-brand-light mt-0.5" />}
    </div>
  );
}

/** Full card in the sessions list */
function SessionCard({ session }: { session: Session }) {
  return (
    <div
      className={`rounded-lg p-4 border-l-4 hover:shadow-md transition-all ${
        session.bookedByUser
          ? 'bg-brand-light/10 border-l-brand-light'
          : 'bg-background border-l-brand-light shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-semibold text-brand-primary">
          {session.groupNames?.[0] || 'Trainingsgruppe'}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {session.bookedByUser && (
            <Badge variant="success" size="sm">
              Gebucht
            </Badge>
          )}
          <Badge variant="secondary" size="sm">
            {session.maxParticipants} Plätze
          </Badge>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock size={13} />
          <span>
            {DAYS[(session.dayOfWeek ?? 1) - 1]} · {session.startTime}–{session.endTime}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <User size={13} />
          <span>{session.trainerName || 'Trainer'}</span>
        </div>
      </div>
      {session.groupNames && session.groupNames.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.groupNames.slice(1).map((n) => (
            <Badge key={n} variant="secondary" size="sm">
              {n}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
