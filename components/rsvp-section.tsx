'use client';

import { useState, useRef } from 'react';
import { CalendarIcon, Hourglass } from 'lucide-react';
import { useSubmitRsvp } from '@/hooks/use-rsvp';
import { generateICal, downloadICal, googleCalendarUrl } from '@/lib/ical-export';
import {
  RSVP_ACTION_KEYS,
  getRsvpStatusConfig,
  normalizeRsvpStatus,
  type RsvpStatusKey,
} from '@/lib/rsvp-status';
import { cn } from '@/lib/utils';

interface RsvpSectionProps {
  sessionId: string;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  courtName?: string;
  trainerName?: string;
  currentStatus?: string | null;
}

export function RsvpSection({
  sessionId,
  sessionDate,
  startTime,
  endTime,
  courtName,
  trainerName,
  currentStatus,
}: RsvpSectionProps) {
  // Normalize to canonical key so the button highlight matches the badge semantics
  const [status, setStatus] = useState<RsvpStatusKey | null>(
    currentStatus ? normalizeRsvpStatus(currentStatus) : null
  );
  const submitRsvp = useSubmitRsvp();
  const isPending = submitRsvp.isPending;
  const actionGroupRef = useRef<HTMLDivElement>(null);
  const firstActionButtonRef = useRef<HTMLButtonElement>(null);

  /** Click on the pending indicator — focus the first action button so the user can respond. */
  const focusFirstAction = () => {
    firstActionButtonRef.current?.focus();
  };

  const handleRsvp = async (newStatus: 'accepted' | 'declined' | 'maybe') => {
    setStatus(newStatus);
    try {
      await submitRsvp.mutateAsync({ sessionId, status: newStatus });
    } catch {
      // Revert on failure so the UI matches the server state
      setStatus(currentStatus ? normalizeRsvpStatus(currentStatus) : null);
    }
  };

  const handleExportICal = () => {
    const dtStart = new Date(sessionDate);
    const [sh, sm] = startTime.split(':').map(Number);
    dtStart.setHours(sh, sm, 0, 0);

    const dtEnd = new Date(sessionDate);
    const [eh, em] = endTime.split(':').map(Number);
    dtEnd.setHours(eh, em, 0, 0);

    const icalContent = generateICal([
      {
        uid: `session-${sessionId}@swingz`,
        summary: `Training: ${courtName || 'Platz'}`,
        description: `Training mit ${trainerName || 'Trainer'}`,
        location: courtName || 'Vereinsplatz',
        dtStart,
        dtEnd,
      },
    ]);

    downloadICal(icalContent, `training-${sessionId}`);
  };

  const handleGoogleCal = () => {
    const dtStart = new Date(sessionDate);
    const [sh, sm] = startTime.split(':').map(Number);
    dtStart.setHours(sh, sm, 0, 0);

    const dtEnd = new Date(sessionDate);
    const [eh, em] = endTime.split(':').map(Number);
    dtEnd.setHours(eh, em, 0, 0);

    const url = googleCalendarUrl({
      uid: sessionId,
      summary: `Training: ${courtName || 'Platz'}`,
      description: `Training mit ${trainerName || 'Trainer'}`,
      location: courtName || 'Vereinsplatz',
      dtStart,
      dtEnd,
    });

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* RSVP Action Buttons — colors mirror getRsvpStatusBadge exactly */}
      <div
        ref={actionGroupRef}
        className="flex items-center gap-1.5"
        role="group"
        aria-label="RSVP-Status setzen"
      >
        {RSVP_ACTION_KEYS.map((key, idx) => {
          const cfg = getRsvpStatusConfig(key);
          const Icon = cfg.buttonIcon;
          const isActive = status === key;
          return (
            <button
              key={key}
              ref={idx === 0 ? firstActionButtonRef : undefined}
              onClick={() => handleRsvp(key as 'accepted' | 'declined' | 'maybe')}
              disabled={isPending}
              aria-pressed={isActive}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-transparent transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-primary/40',
                isActive ? cfg.buttonActiveClass : cfg.buttonClass
              )}
              title={cfg.label}
              data-rsvp-status={key}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar Export Buttons (unchanged) */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleExportICal}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted hover:bg-info-50 hover:text-info-600 transition-all"
          title="In Kalender exportieren (.ics)"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">iCal</span>
        </button>
        <button
          onClick={handleGoogleCal}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted hover:bg-info-50 hover:text-info-600 transition-all"
          title="Zu Google Kalender hinzufügen"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Google</span>
        </button>
      </div>

      {/* Live status indicator — uses the same badge class for consistency.
          When the status is "pending" (no response yet) the indicator is
          rendered as a clickable button so the user can jump straight to
          the action buttons to submit their RSVP. */}
      {status &&
        (status === 'pending' ? (
          <button
            type="button"
            onClick={focusFirstAction}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium border cursor-pointer transition-all',
              'hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40',
              'bg-info-100 text-info-700 border-info-200 animate-pulse'
            )}
            aria-label="Jetzt antworten — fokussiert die RSVP-Action-Buttons"
            title="Klicken um zu antworten"
          >
            <Hourglass className="h-3 w-3" />
            Jetzt antworten
          </button>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium border',
              getRsvpStatusConfig(status).badgeClass
            )}
            aria-live="polite"
          >
            Status: {getRsvpStatusConfig(status).label}
          </span>
        ))}
    </div>
  );
}
