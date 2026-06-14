import { format, parseISO } from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  organizer?: {
    name: string;
    email: string;
  };
}

/**
 * Generate ICS (iCalendar) file content from events
 */
export function generateICS(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SwingZ//Tennis Club Management//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@mail.swingz.cloud`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART:${formatICSDate(event.start)}`);
    lines.push(`DTEND:${formatICSDate(event.end)}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }

    if (event.organizer) {
      lines.push(`ORGANIZER;CN=${escapeICS(event.organizer.name)}:mailto:${event.organizer.email}`);
    }

    if (event.attendees && event.attendees.length > 0) {
      event.attendees.forEach((attendee) => {
        lines.push(`ATTENDEE;RSVP=TRUE:mailto:${attendee}`);
      });
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Format date for ICS format (YYYYMMDDTHHMMSSZ)
 */
function formatICSDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Download ICS file
 */
export function downloadICS(
  events: CalendarEvent[],
  filename: string = 'swingz-calendar.ics'
): void {
  const icsContent = generateICS(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar URL for a single event
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const baseUrl = 'https://calendar.google.com/calendar/render';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.start)}/${formatGoogleDate(event.end)}`,
  });

  if (event.description) {
    params.append('details', event.description);
  }

  if (event.location) {
    params.append('location', event.location);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Format date for Google Calendar (YYYYMMDDTHHMMSSZ)
 */
function formatGoogleDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Open Google Calendar in new tab
 */
export function openGoogleCalendar(event: CalendarEvent): void {
  const url = generateGoogleCalendarUrl(event);
  window.open(url, '_blank');
}

/** Input shape for calendar export — subset of session fields we need */
export interface SessionExportInput {
  id: string;
  timeslotStart: string;
  startTime: string;
  endTime: string;
  trainerName?: string;
  notes?: string;
  courtId?: string;
}

/**
 * Convert session data to calendar event
 */
export function sessionToCalendarEvent(
  session: SessionExportInput,
  courtName?: string
): CalendarEvent {
  const sessionDate = parseISO(session.timeslotStart);
  const [startHour, startMinute] = session.startTime.split(':').map(Number);
  const [endHour, endMinute] = session.endTime.split(':').map(Number);

  const startDate = new Date(sessionDate);
  startDate.setHours(startHour, startMinute, 0, 0);

  const endDate = new Date(sessionDate);
  endDate.setHours(endHour, endMinute, 0, 0);

  return {
    id: session.id,
    title: `Tennis Training - ${session.trainerName || 'Trainer'}`,
    description: session.notes || `Training session with ${session.trainerName || 'Trainer'}`,
    location: courtName || 'Tennis Court',
    start: startDate,
    end: endDate,
    organizer: session.trainerName
      ? {
          name: session.trainerName,
          email: `${session.trainerName.toLowerCase().replace(/\s+/g, '.')}@mail.swingz.cloud`,
        }
      : undefined,
  };
}

/**
 * Export multiple sessions to ICS
 */
export function exportSessionsToICS(
  sessions: SessionExportInput[],
  courts: Array<{ id: string; name: string }>
): void {
  const events = sessions.map((session) => {
    const court = courts.find((c) => c.id === session.courtId);
    return sessionToCalendarEvent(session, court?.name);
  });

  const filename = `swingz-training-${format(new Date(), 'yyyy-MM-dd')}.ics`;
  downloadICS(events, filename);
}

/**
 * Export single session to Google Calendar
 */
export function exportSessionToGoogleCalendar(
  session: SessionExportInput,
  courtName?: string
): void {
  const event = sessionToCalendarEvent(session, courtName);
  openGoogleCalendar(event);
}
