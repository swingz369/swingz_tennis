'use client';

import { useState } from 'react';
import { Check, X, HelpCircle, CalendarIcon } from 'lucide-react';
import { useSubmitRsvp } from '@/hooks/use-rsvp';
import { generateICal, downloadICal, googleCalendarUrl } from '@/lib/ical-export';

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
  const [status, setStatus] = useState<string | null>(currentStatus || null);
  const submitRsvp = useSubmitRsvp();
  const isPending = submitRsvp.isPending;

  const handleRsvp = async (newStatus: 'accepted' | 'declined' | 'maybe') => {
    setStatus(newStatus);
    await submitRsvp.mutateAsync({ sessionId, status: newStatus });
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

  const getButtonStyle = (btnStatus: string) => {
    if (status === btnStatus) {
      switch (btnStatus) {
        case 'accepted':
          return 'bg-green-100 text-green-700 ring-1 ring-green-400';
        case 'declined':
          return 'bg-red-100 text-red-700 ring-1 ring-red-400';
        case 'maybe':
          return 'bg-amber-100 text-amber-700 ring-1 ring-amber-400';
      }
    }
    return 'bg-muted text-muted-foreground hover:bg-muted';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* RSVP Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleRsvp('accepted')}
          disabled={isPending}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${getButtonStyle('accepted')}`}
          title="Ich komme"
        >
          <Check className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Komm</span>
        </button>
        <button
          onClick={() => handleRsvp('declined')}
          disabled={isPending}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${getButtonStyle('declined')}`}
          title="Ich fehle"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fehle</span>
        </button>
        <button
          onClick={() => handleRsvp('maybe')}
          disabled={isPending}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${getButtonStyle('maybe')}`}
          title="Vielleicht"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Vllt.</span>
        </button>
      </div>

      {/* Calendar Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleExportICal}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted hover:bg-blue-50 hover:text-blue-600 transition-all"
          title="In Kalender exportieren (.ics)"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">iCal</span>
        </button>
        <button
          onClick={handleGoogleCal}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted hover:bg-blue-50 hover:text-blue-600 transition-all"
          title="Zu Google Kalender hinzufügen"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Google</span>
        </button>
      </div>
    </div>
  );
}
