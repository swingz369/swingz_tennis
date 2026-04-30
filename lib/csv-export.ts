/**
 * Convert an array of objects to CSV string with UTF-8 BOM for Excel
 */
export function convertToCSV(
  data: Record<string, unknown>[],
  headers?: Record<string, string>
): string {
  if (!data || data.length === 0) return '';

  const allKeys = headers ? Object.keys(headers) : Object.keys(data[0]);

  // Build header row
  const headerRow = allKeys.map((key) => `"${headers?.[key] || key}"`).join(',');

  // Build data rows
  const rows = data.map((item) => {
    return allKeys
      .map((key) => {
        const value = item[key];
        if (value === null || value === undefined) return '""';
        // Escape quotes and wrap in quotes
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
  });

  // Prepend UTF-8 BOM for Excel compatibility
  const csvContent = [headerRow, ...rows].join('\n');
  return '\uFEFF' + csvContent;
}

/**
 * Download CSV as a file
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export bookings to CSV
 */
export function exportBookingsCSV(
  bookings: {
    id: string;
    status: string;
    bookedAt: string;
    session?: {
      startTime: string;
      endTime: string;
      trainerId: string;
      court: string;
    } | null;
    memberId?: string;
  }[]
): void {
  const headers: Record<string, string> = {
    id: 'Buchungs-ID',
    memberId: 'Mitglied-ID',
    status: 'Status',
    bookedAt: 'Gebucht am',
    startTime: 'Startzeit',
    endTime: 'Endzeit',
    trainerId: 'Trainer-ID',
    court: 'Platz',
  };

  const data = bookings.map((b) => ({
    id: b.id,
    memberId: b.memberId || '',
    status: b.status,
    bookedAt: new Date(b.bookedAt).toLocaleDateString('de-DE'),
    startTime: b.session?.startTime || '',
    endTime: b.session?.endTime || '',
    trainerId: b.session?.trainerId || '',
    court: b.session?.court || '',
  }));

  const csv = convertToCSV(data, headers);
  downloadCSV(csv, 'buchungen');
}

/**
 * Export members to CSV
 */
export function exportMembersCSV(
  members: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    joined_at: string;
  }[]
): void {
  const headers: Record<string, string> = {
    id: 'Mitglieds-ID',
    full_name: 'Name',
    email: 'E-Mail',
    role: 'Rolle',
    is_active: 'Aktiv',
    joined_at: 'Beigetreten am',
  };

  const data = members.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    email: m.email,
    role: m.role,
    is_active: m.is_active ? 'Ja' : 'Nein',
    joined_at: new Date(m.joined_at).toLocaleDateString('de-DE'),
  }));

  const csv = convertToCSV(data, headers);
  downloadCSV(csv, 'mitglieder');
}
