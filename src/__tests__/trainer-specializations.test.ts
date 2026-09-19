import { describe, it, expect } from 'vitest';
import { normalizeSpecializations } from '@/infrastructure/persistence/repositories/trainer-profile.repository';

// Produktion lieferte kein Array — `.slice().map()` in der Trainer-Liste warf.
describe('normalizeSpecializations', () => {
  it('liefert immer ein Array', () => {
    for (const raw of [null, undefined, {}, 42, '', '{"a":1}']) {
      expect(normalizeSpecializations(raw)).toEqual([]);
    }
  });

  it('liest JSON-String, String-Array und Objekte', () => {
    expect(normalizeSpecializations('["senior"]')[0].name).toBe('senior');
    expect(normalizeSpecializations(['kids'])[0]).toMatchObject({ name: 'kids' });
    expect(normalizeSpecializations([{ id: 'a', name: 'Jugend', level: 'advanced' }])).toEqual([
      { id: 'a', name: 'Jugend', level: 'advanced' },
    ]);
  });
});
