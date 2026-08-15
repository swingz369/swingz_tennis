import { describe, it, expect } from 'vitest';
import { normalizeQualifications } from '@/infrastructure/persistence/repositories/trainer-profile.repository';

// Die JSONB-Spalte trainer_profiles.qualifications enthält drei Formen
// nebeneinander. Vor dem Normalisieren lieferte der Cast Einträge ohne `id`
// und ohne `name` — React meldete fehlende keys, die Karten blieben leer.
describe('normalizeQualifications', () => {
  it('behält vollständige Objekte samt ihrer id', () => {
    const [q] = normalizeQualifications([
      {
        id: 'qual-1',
        name: 'DTB A-Lizenz',
        issuer: 'DTB',
        issuedDate: '2024-01-01',
        verified: true,
      },
    ]);
    expect(q.id).toBe('qual-1');
    expect(q.name).toBe('DTB A-Lizenz');
    expect(q.verified).toBe(true);
  });

  it('macht aus einfachen Strings vollständige Einträge mit stabiler id', () => {
    const qs = normalizeQualifications(['DTB C-Lizenz', 'DTB B-Lizenz']);
    expect(qs.map((q) => q.name)).toEqual(['DTB C-Lizenz', 'DTB B-Lizenz']);
    expect(new Set(qs.map((q) => q.id)).size).toBe(2);
    expect(qs.every((q) => q.id.length > 0)).toBe(true);
  });

  it('liest die ältere Form, in der der Array als JSON-String gespeichert ist', () => {
    const qs = normalizeQualifications('["DTB C-Lizenz"]');
    expect(qs).toHaveLength(1);
    expect(qs[0].name).toBe('DTB C-Lizenz');
  });

  it('ergänzt fehlende Pflichtfelder statt sie undefined zu lassen', () => {
    const [q] = normalizeQualifications([{ name: 'Kindertrainer' }]);
    expect(q.issuer).toBe('');
    expect(q.issuedDate).toBe('');
    expect(q.verified).toBe(false);
    expect(q.id).toContain('Kindertrainer');
  });

  it('liefert für null, undefined und Unsinn eine leere Liste', () => {
    expect(normalizeQualifications(null)).toEqual([]);
    expect(normalizeQualifications(undefined)).toEqual([]);
    expect(normalizeQualifications(42)).toEqual([]);
    expect(normalizeQualifications('')).toEqual([]);
  });
});
