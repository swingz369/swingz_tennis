import { describe, it, expect } from 'vitest';
import { auditSubject, auditDetailLines } from '@/lib/audit-labels';

describe('auditSubject', () => {
  it('benennt das Objekt statt nur den Typ', () => {
    expect(
      auditSubject({ resource_type: 'club', details: { club_name_before_delete: 'TC Neuland' } })
    ).toBe('Verein · TC Neuland');
  });

  it('fällt auf den Objekttyp zurück, wenn kein Name in den Details steht', () => {
    expect(auditSubject({ resource_type: 'invoice', details: { amount: 42 } })).toBe('Rechnung');
  });

  it('bleibt lesbar, wenn gar nichts da ist — die rohe UUID hilft niemandem', () => {
    expect(auditSubject({ resource_type: null, details: null })).toBe('—');
  });
});

describe('auditDetailLines', () => {
  it('beschriftet bekannte Schlüssel und lässt leere Werte weg', () => {
    expect(
      auditDetailLines({ invoice_number: 'R-2026-001', status: 'sent', notes: null, reason: '' })
    ).toEqual([
      { label: 'Rechnungsnummer', value: 'R-2026-001' },
      { label: 'Status', value: 'sent' },
    ]);
  });

  it('macht unbekannte Schlüssel lesbar statt sie zu verwerfen', () => {
    expect(auditDetailLines({ deactivated_members_count: 3, some_new_key: true })).toEqual([
      { label: 'Deaktivierte Mitglieder', value: '3' },
      { label: 'Some new key', value: 'ja' },
    ]);
  });

  it('flacht Arrays und verschachtelte Objekte ab statt rohes JSON zu zeigen', () => {
    expect(auditDetailLines({ changed_fields: ['name', 'email'] })).toEqual([
      { label: 'Geänderte Felder', value: 'name, email' },
    ]);
    expect(auditDetailLines({ from: { role: 'member' } })).toEqual([
      { label: 'Von', value: 'Role: member' },
    ]);
  });
});
