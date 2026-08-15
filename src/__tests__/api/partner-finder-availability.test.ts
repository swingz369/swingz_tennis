// Zeitfenster-Zerlegung der Spielpartner-Suche. Die Mengen-Schnittmenge daraus
// entscheidet, ob zwei Mitglieder überhaupt zusammen spielen können — und sortiert
// Treffer aus, bei denen sich keine Stunde überschneidet.

import { describe, it, expect } from 'vitest';
import { availabilitySlots } from '@/app/api/partner-finder/route';

const overlap = (a: string[], b: string[]) => a.filter((s) => new Set(b).has(s));

describe('availabilitySlots', () => {
  it('zerlegt ein Intervall in Stundenmarken, Ende exklusiv', () => {
    expect(availabilitySlots({ monday: [{ start: '18:00', end: '21:00' }] })).toEqual([
      'monday-18',
      'monday-19',
      'monday-20',
    ]);
  });

  it('liefert für fehlende Angaben eine leere Liste statt zu werfen', () => {
    expect(availabilitySlots(null)).toEqual([]);
    expect(availabilitySlots({})).toEqual([]);
    expect(availabilitySlots({ friday: [] })).toEqual([]);
  });

  it('überspringt unbrauchbare Zeitangaben, statt NaN-Marken zu erzeugen', () => {
    const slots = availabilitySlots({
      monday: [{ start: 'abends', end: '21:00' }],
      tuesday: [{ start: '17:00', end: '19:00' }],
    });
    expect(slots).toEqual(['tuesday-17', 'tuesday-18']);
  });

  it('erkennt eine Überschneidung nur bei derselben Stunde am selben Tag', () => {
    const anna = availabilitySlots({ tuesday: [{ start: '17:00', end: '20:00' }] });
    const bernd = availabilitySlots({ tuesday: [{ start: '19:00', end: '21:00' }] });
    const carla = availabilitySlots({ wednesday: [{ start: '17:00', end: '20:00' }] });

    expect(overlap(anna, bernd)).toEqual(['tuesday-19']);
    // Gleiche Uhrzeit, anderer Tag — darf nicht als Treffer durchgehen.
    expect(overlap(anna, carla)).toEqual([]);
  });

  it('addiert mehrere Blöcke eines Tages', () => {
    const slots = availabilitySlots({
      saturday: [
        { start: '09:00', end: '11:00' },
        { start: '15:00', end: '16:00' },
      ],
    });
    expect(slots).toEqual(['saturday-9', 'saturday-10', 'saturday-15']);
  });
});
