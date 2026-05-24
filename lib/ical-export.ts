/**
 * iCal export utility for SwingZ.
 * Generates standard .ics (RFC 5545) calendar files from session data.
 */

export interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtStart: Date;
  dtEnd: Date;
  recurrenceRule?: string; // e.g. "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=16"
}

function formatDate(date: Date): string {
  // Format: 20240101T100000Z
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // RFC 5545 line folding: each line max 75 octets
  const maxLen = 75;
  if (line.length <= maxLen) return line;
  const parts: string[] = [];
  parts.push(line.substring(0, maxLen));
  let remaining = line.substring(maxLen);
  while (remaining.length > 0) {
    // Continuation lines start with a space
    const chunk = remaining.substring(0, 74);
    parts.push(' ' + chunk);
    remaining = remaining.substring(74);
  }
  return parts.join('\r\n');
}

export function generateICal(events: ICalEvent[]): string {
  const now = formatDate(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SwingZ//SwingZ Calendar//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTART:${formatDate(event.dtStart)}`);
    lines.push(`DTEND:${formatDate(event.dtEnd)}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }
    if (event.recurrenceRule) {
      lines.push(`RRULE:${event.recurrenceRule}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // Fold long lines and join with CRLF
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Downloads an .ics file in the browser.
 */
export function downloadICal(icalContent: string, filename: string): void {
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates a Google Calendar URL for a single event.
 */
export function googleCalendarUrl(event: ICalEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${formatDate(event.dtStart)}/${formatDate(event.dtEnd)}`,
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
