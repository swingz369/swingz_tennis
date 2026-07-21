'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, User, MapPin, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessions, type Session } from '@/hooks/use-sessions';
import { useUserRoles, useUserClub } from '@/hooks/use-user-data';
import { useCurrentUser } from '@/hooks/use-current-user';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { RescheduleSessionDialog } from '@/components/scheduler/reschedule-session-dialog';
import { QUERY_KEYS } from '@/lib/cache';

// ponytail: module-level so Date.now() isn't called on each render (react-hooks/purity)
const ADMIN_DATE_FROM = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const ADMIN_DATE_TO = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

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
  const queryClient = useQueryClient();

  const { data: user } = useCurrentUser();
  const { data: roles = [] } = useUserRoles();
  const [editSession, setEditSession] = useState<Session | null>(null);

  const isAdmin = roles.includes('admin') || roles.includes('superadmin');
  const isTrainer = roles.includes('trainer');

  // Admins see the full season schedule (up to 1 year); members see only upcoming bookable sessions
  const adminDateRange = isAdmin ? { dateFrom: ADMIN_DATE_FROM, dateTo: ADMIN_DATE_TO } : undefined;

  const { data: allSessions = [], isLoading, error } = useSessions(clubId, adminDateRange);
  const isMember = !isAdmin && !isTrainer;

  const subtitle = isAdmin
    ? 'Wochenstundenplan — alle Trainingsgruppen'
    : isTrainer
      ? 'Deine zugewiesenen Trainingseinheiten'
      : 'Dein Trainingsplan · Gebuchte Sessions sind markiert';

  // For the grid: collapse the many future weekly occurrences of the same
  // recurring slot (day+time+court+group) into one representative card, but
  // keep concurrent sessions on different courts/groups at the same day+time
  // as separate cards — otherwise parallel trainings silently disappear.
  const slotMap = useMemo(() => {
    const now = new Date();
    const representatives = new Map<string, Session>();
    // Sort ascending so we pick the soonest upcoming occurrence as representative
    const sorted = [...allSessions].sort((a, b) =>
      (a.timeslotStart ?? '').localeCompare(b.timeslotStart ?? '')
    );
    for (const s of sorted) {
      const slotKey = `${s.dayOfWeek}-${s.startTime}-${s.courtId ?? 'none'}-${(s.groupIds ?? []).join(',')}`;
      const existing = representatives.get(slotKey);
      if (!existing) {
        representatives.set(slotKey, s);
        continue;
      }
      const sDate = s.timeslotStart ? new Date(s.timeslotStart) : null;
      const existDate = existing.timeslotStart ? new Date(existing.timeslotStart) : null;
      if (sDate && sDate >= now && (!existDate || existDate < now)) {
        representatives.set(slotKey, s);
      }
    }

    const byDayTime = new Map<string, Session[]>();
    for (const s of representatives.values()) {
      const key = `${s.dayOfWeek}-${s.startTime}`;
      const arr = byDayTime.get(key) ?? [];
      arr.push(s);
      byDayTime.set(key, arr);
    }
    return byDayTime;
  }, [allSessions]);

  const getSessionsForSlot = (dayIdx: number, time: string): Session[] => {
    // dayIdx 0=Mo ... 6=So → API dayOfWeek 1=Mo ... 7=So
    const dayOfWeek = dayIdx + 1;
    return slotMap.get(`${dayOfWeek}-${time}`) ?? [];
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
          <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
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
      <CalendarShell title="Stundenplan" subtitle={subtitle} />

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">Tabellenansicht</TabsTrigger>
          <TabsTrigger value="list">
            {isMember
              ? 'Meine gebuchten Sessions'
              : isTrainer
                ? 'Meine Einheiten'
                : 'Alle Sessions'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
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
                          <SessionSlotCard
                            key={s.id}
                            session={s}
                            onEdit={isAdmin && s.planEntryId ? () => setEditSession(s) : undefined}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="list">
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
        </TabsContent>
      </Tabs>

      {editSession && (
        <RescheduleSessionDialog
          session={editSession}
          onClose={() => setEditSession(null)}
          onSuccess={() => {
            setEditSession(null);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sessions(clubId || '') });
          }}
        />
      )}
    </div>
  );
}

/** Compact card shown inside the grid slot */
function SessionSlotCard({ session, onEdit }: { session: Session; onEdit?: () => void }) {
  return (
    <div
      className={`group relative p-1.5 rounded text-xs border ${
        session.bookedByUser
          ? 'bg-brand-light/15 border-brand-light/40 text-brand-light'
          : 'bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-800 text-info-800 dark:text-info-300'
      }`}
    >
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Trainingszeit verschieben"
          className="absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      <div className="font-medium truncate">{session.trainerName || 'Trainer'}</div>
      <div className="text-2xs text-muted-foreground truncate">
        {session.startTime}–{session.endTime}
        {session.courtName && ` · ${session.courtName}`}
      </div>
      {session.bookedByUser && <div className="w-1.5 h-1.5 rounded-full bg-brand-light mt-0.5" />}
    </div>
  );
}

/** Full card in the sessions list */
function SessionCard({ session }: { session: Session }) {
  return (
    <div
      className={`rounded-xl p-4 border-l-4 hover:shadow-md transition-all ${
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
        {session.courtName && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin size={13} />
            <span>{session.courtName}</span>
          </div>
        )}
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
