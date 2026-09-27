import { describe, expect, it } from 'vitest';

import { toSpecialties } from '@/lib/season-planning/clustering-engine';

describe('toSpecialties', () => {
  it('nimmt jede jsonb-Form an, ohne zu werfen', () => {
    expect(toSpecialties(['Jugend', 3, 'Anfänger'])).toEqual(['Jugend', 'Anfänger']);
    expect(toSpecialties('Jugend, Anfänger')).toEqual(['Jugend', 'Anfänger']);
    expect(toSpecialties({ jugend: true })).toEqual([]);
    expect(toSpecialties(null)).toEqual([]);
  });
});
