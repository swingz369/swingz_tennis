'use client';

/**
 * WartlisteButton — Zeigt Wartelisten-Aktionen für eine volle Session an.
 * Wird in der Buchungsübersicht angezeigt wenn max_participants erreicht ist
 * und das Mitglied noch keine Buchung hat.
 */
import { useWaitlistPosition, useJoinWaitlist, useLeaveWaitlist } from '@/hooks/use-sessions';
import { Loader2 } from 'lucide-react';

interface SessionWaitlistButtonProps {
  sessionId: string;
  clubId: string;
  /** Anzahl aktiver Buchungen für diese Session */
  currentBookings: number;
  /** Maximale Teilnehmer der Session */
  maxParticipants: number;
  /** True wenn das Mitglied bereits eine Buchung hat */
  bookedByUser: boolean;
}

export default function SessionWaitlistButton({
  sessionId,
  clubId,
  currentBookings,
  maxParticipants,
  bookedByUser,
}: SessionWaitlistButtonProps) {
  const isFull = currentBookings >= maxParticipants;

  const { data: waitlistEntry, isLoading: loadingPos } = useWaitlistPosition(
    !bookedByUser && isFull ? sessionId : null
  );
  const joinWaitlist = useJoinWaitlist();
  const leaveWaitlist = useLeaveWaitlist();

  // Nur anzeigen wenn Session voll und noch keine Buchung
  if (!isFull || bookedByUser) return null;

  if (loadingPos) {
    return (
      <div className="flex items-center gap-1 mt-0.5">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (waitlistEntry) {
    return (
      <div className="mt-0.5 space-y-0.5">
        <span className="inline-block text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full leading-tight">
          Warteliste #{waitlistEntry.position}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            leaveWaitlist.mutate({ sessionId });
          }}
          disabled={leaveWaitlist.isPending}
          className="block w-full text-[10px] text-left text-red-500 hover:underline leading-tight disabled:opacity-50"
        >
          {leaveWaitlist.isPending ? 'Wird entfernt…' : 'Entfernen'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        joinWaitlist.mutate({ sessionId, clubId });
      }}
      disabled={joinWaitlist.isPending}
      className="mt-0.5 w-full text-left text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 leading-tight"
    >
      {joinWaitlist.isPending ? (
        <span className="flex items-center gap-1">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Wird eingetragen…
        </span>
      ) : (
        'Warteliste'
      )}
    </button>
  );
}
