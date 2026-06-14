import { parse } from 'csv-parse/sync';

export interface CsvMemberRecord {
  email: string;
  fullName: string;
  role: 'member' | 'trainer';
  phone?: string;
  dateOfBirth?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
}

function sanitizeCsvField(value: string): string {
  if (!value) return value;
  return value
    .replace(/^=/, "'=")
    .replace(/^@/, "'@")
    .replace(/^\+/, "'+")
    .replace(/^-/, "'-")
    .replace(/\t/g, '    ')
    .replace(/\r?\n/g, ' ');
}

export function parseMemberCsv(
  csvContent: string,
  defaultRole?: 'member' | 'trainer'
): CsvMemberRecord[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return (records as Record<string, string>[]).map((record) => ({
    email: sanitizeCsvField(record['E-Mail'] || record['email'] || '')
      .toLowerCase()
      .trim(),
    fullName: sanitizeCsvField(record['Name'] || record['full_name'] || record['name'] || ''),
    role: normalizeRole(record['Rolle'] || record['role'] || defaultRole || 'member'),
    phone: sanitizeCsvField(record['Telefon'] || record['phone'] || '') || undefined,
    dateOfBirth:
      sanitizeCsvField(
        record['Geburtsdatum'] || record['date_of_birth'] || record['birthdate'] || ''
      ) || undefined,
    street:
      sanitizeCsvField(
        record['Straße'] || record['Strasse'] || record['street'] || record['address'] || ''
      ) || undefined,
    postalCode:
      sanitizeCsvField(record['PLZ'] || record['postal_code'] || record['zip'] || '') || undefined,
    city: sanitizeCsvField(record['Ort'] || record['Stadt'] || record['city'] || '') || undefined,
    notes: sanitizeCsvField(record['Notizen'] || record['notes'] || '') || undefined,
  }));
}

function normalizeRole(role: string): 'member' | 'trainer' {
  const normalized = role.toLowerCase().trim();
  if (['trainer', 'trainier', 't'].includes(normalized)) return 'trainer';
  return 'member';
}

export function validateMemberRecords(records: CsvMemberRecord[]): {
  valid: CsvMemberRecord[];
  invalid: Array<{ record: CsvMemberRecord; errors: string[] }>;
} {
  const valid: CsvMemberRecord[] = [];
  const invalid: Array<{ record: CsvMemberRecord; errors: string[] }> = [];

  records.forEach((record) => {
    const errors: string[] = [];

    if (!record.email) {
      errors.push('E-Mail fehlt');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      errors.push(`Ungültige E-Mail: ${record.email}`);
    }

    if (!record.fullName || record.fullName.length < 2) {
      errors.push('Name muss mindestens 2 Zeichen haben');
    }

    if (record.fullName && record.fullName.length > 200) {
      errors.push('Name ist zu lang (max. 200 Zeichen)');
    }

    if (errors.length > 0) {
      invalid.push({ record, errors });
    } else {
      valid.push(record);
    }
  });

  return { valid, invalid };
}

export function generateMemberCsvTemplate(): string {
  const headers = [
    'E-Mail',
    'Name',
    'Rolle',
    'Telefon',
    'Geburtsdatum',
    'Straße',
    'PLZ',
    'Ort',
    'Notizen',
  ];

  const exampleRows = [
    [
      'max.mustermann@beispiel.de',
      'Max Mustermann',
      'member',
      '0170 1234567',
      '15.03.1990',
      'Tennisweg 1',
      '50667',
      'Köln',
      'Erwachsen',
    ],
    [
      'anna.schmidt@beispiel.de',
      'Anna Schmidt',
      'trainer',
      '',
      '22.08.1985',
      'Sportallee 5',
      '40210',
      'Düsseldorf',
      'Tennistrainerin B-Lizenz',
    ],
    [
      'jugend.spieler@beispiel.de',
      'Jugend Spieler',
      'member',
      '0151 9876543',
      '10.11.2010',
      'Am Platz 3',
      '53111',
      'Bonn',
      'U14, Eltern: 0170...',
    ],
  ];

  return [headers.join(','), ...exampleRows.map((r) => r.join(','))].join('\n');
}

export function generateTrainerCsvTemplate(): string {
  const headers = ['E-Mail', 'Name', 'Telefon', 'Geburtsdatum', 'Straße', 'PLZ', 'Ort', 'Notizen'];

  const exampleRows = [
    [
      'thomas.mueller@beispiel.de',
      'Thomas Müller',
      '0170 1112233',
      '05.06.1988',
      'Tennishalle 1',
      '50667',
      'Köln',
      'A-Lizenz, 10 Jahre Erfahrung',
    ],
    [
      'lisa.weber@beispiel.de',
      'Lisa Weber',
      '0151 4445566',
      '12.09.1992',
      'Sportpark 7',
      '40210',
      'Düsseldorf',
      'B-Lizenz, Junioren-Training',
    ],
  ];

  return [headers.join(','), ...exampleRows.map((r) => r.join(','))].join('\n');
}
