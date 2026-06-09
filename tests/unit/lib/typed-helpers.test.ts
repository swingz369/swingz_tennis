import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  extractErrorMessage,
  unwrapJoin,
  unwrapJoins,
  DEFAULT_COURT,
  DEFAULT_USER,
  DEFAULT_TRAINER,
  DEFAULT_SESSION,
  type DefaultCourtShape,
  type DefaultUserShape,
  type DefaultTrainerShape,
  type DefaultSessionShape,
} from '@/lib/typed-helpers';

// =============================================================================
// getErrorMessage
// =============================================================================
describe('getErrorMessage', () => {
  it('extrahiert die .message aus einer Error-Instanz', () => {
    const err = new Error('Netzwerkfehler');
    expect(getErrorMessage(err)).toBe('Netzwerkfehler');
  });

  it('gibt den String direkt zurück, wenn err ein String ist', () => {
    expect(getErrorMessage('Etwas ist schiefgelaufen')).toBe('Etwas ist schiefgelaufen');
  });

  it('extrahiert .message aus einem plain object', () => {
    expect(getErrorMessage({ message: 'Server-Fehler 500' })).toBe('Server-Fehler 500');
  });

  it('fällt auf "Unbekannter Fehler" zurück für null/undefined', () => {
    expect(getErrorMessage(null)).toBe('Unbekannter Fehler');
    expect(getErrorMessage(undefined)).toBe('Unbekannter Fehler');
  });

  it('fällt auf "Unbekannter Fehler" zurück für leere Objekte', () => {
    expect(getErrorMessage({})).toBe('Unbekannter Fehler');
    expect(getErrorMessage({ foo: 'bar' })).toBe('Unbekannter Fehler');
  });

  it('fällt auf "Unbekannter Fehler" zurück für Zahlen, Booleans', () => {
    expect(getErrorMessage(42)).toBe('Unbekannter Fehler');
    expect(getErrorMessage(true)).toBe('Unbekannter Fehler');
  });

  it('ignoriert .message wenn diese kein String ist', () => {
    expect(getErrorMessage({ message: 42 })).toBe('Unbekannter Fehler');
    expect(getErrorMessage({ message: null })).toBe('Unbekannter Fehler');
  });

  it('behandelt verschachtelte Error-ähnliche Objekte', () => {
    expect(getErrorMessage({ message: { nested: 'fail' } })).toBe('Unbekannter Fehler');
  });
});

// =============================================================================
// extractErrorMessage
// =============================================================================
describe('extractErrorMessage', () => {
  it('gibt den String zurück, wenn data ein String ist', () => {
    expect(extractErrorMessage('Nicht erlaubt')).toBe('Nicht erlaubt');
  });

  it('extrahiert { error: string }', () => {
    expect(extractErrorMessage({ error: 'Token ungültig' })).toBe('Token ungültig');
  });

  it('extrahiert { message: string }', () => {
    expect(extractErrorMessage({ message: 'Server-Fehler' })).toBe('Server-Fehler');
  });

  it('extrahiert verschachteltes { error: { message: string } }', () => {
    expect(extractErrorMessage({ error: { message: 'Permission denied' } })).toBe(
      'Permission denied'
    );
  });

  it('extrahiert aus { data: { error: string } }', () => {
    expect(extractErrorMessage({ data: { error: 'Nested data error' } })).toBe('Nested data error');
  });

  it('extrahiert aus { data: "string" }', () => {
    expect(extractErrorMessage({ data: 'Plain data string' })).toBe('Plain data string');
  });

  it('gibt null zurück für null/undefined', () => {
    expect(extractErrorMessage(null)).toBeNull();
    expect(extractErrorMessage(undefined)).toBeNull();
  });

  it('gibt null zurück für Objekte ohne bekanntes Error-Feld', () => {
    expect(extractErrorMessage({ foo: 'bar' })).toBeNull();
    expect(extractErrorMessage({})).toBeNull();
  });

  it('gibt null zurück für Zahlen/Booleans', () => {
    expect(extractErrorMessage(42)).toBeNull();
    expect(extractErrorMessage(true)).toBeNull();
  });

  it('priorisiert error vor message', () => {
    expect(extractErrorMessage({ error: 'first', message: 'second' })).toBe('first');
  });
});

// =============================================================================
// unwrapJoin
// =============================================================================
describe('unwrapJoin', () => {
  interface Court {
    id: string;
    name: string;
  }

  const courtA: Court = { id: 'a', name: 'Court A' };
  const courtB: Court = { id: 'b', name: 'Court B' };

  it('gibt das Objekt direkt zurück wenn value ein einzelnes Objekt ist', () => {
    expect(unwrapJoin<Court>(courtA)).toBe(courtA);
  });

  it('gibt das erste Element zurück wenn value ein Array ist', () => {
    expect(unwrapJoin<Court>([courtA, courtB])).toBe(courtA);
  });

  it('gibt null zurück für ein leeres Array', () => {
    expect(unwrapJoin<Court>([])).toBeNull();
  });

  it('gibt null zurück für null/undefined', () => {
    expect(unwrapJoin<Court>(null)).toBeNull();
    expect(unwrapJoin<Court>(undefined)).toBeNull();
  });

  it('behält Typinformation generic bei', () => {
    // TypeScript-Test: das Result muss Court | null sein
    const result = unwrapJoin<Court>(courtA);
    if (result) {
      // @ts-expect-error - sollte number nicht erlauben
      const _invalid: number = result.id;
      expect(typeof result.id).toBe('string');
    }
  });
});

// =============================================================================
// unwrapJoins
// =============================================================================
describe('unwrapJoins', () => {
  interface Group {
    id: string;
  }

  it('gibt das Array direkt zurück wenn value ein Array ist', () => {
    const arr: Group[] = [{ id: 'g1' }, { id: 'g2' }];
    expect(unwrapJoins<Group>(arr)).toBe(arr);
  });

  it('packt ein einzelnes Objekt in ein Array', () => {
    expect(unwrapJoins<Group>({ id: 'g1' })).toEqual([{ id: 'g1' }]);
  });

  it('gibt ein leeres Array zurück für null/undefined', () => {
    expect(unwrapJoins<Group>(null)).toEqual([]);
    expect(unwrapJoins<Group>(undefined)).toEqual([]);
  });
});

// =============================================================================
// DEFAULT_COURT
// =============================================================================
describe('DEFAULT_COURT', () => {
  it('hat die erwartete Shape', () => {
    const court: DefaultCourtShape = DEFAULT_COURT;
    expect(court).toEqual({ name: null, surface: null, number: null });
  });

  it('alle Felder sind null (sicherer Fallback für fehlende Joins)', () => {
    expect(DEFAULT_COURT.name).toBeNull();
    expect(DEFAULT_COURT.surface).toBeNull();
    expect(DEFAULT_COURT.number).toBeNull();
  });
});

// =============================================================================
// DEFAULT_USER
// =============================================================================
describe('DEFAULT_USER', () => {
  it('hat die erwartete Shape', () => {
    const user: DefaultUserShape = DEFAULT_USER;
    expect(user).toEqual({ id: '', email: null, full_name: null });
  });

  it('id ist leerer String (kein random UUID als Default)', () => {
    expect(DEFAULT_USER.id).toBe('');
  });
});

// =============================================================================
// DEFAULT_TRAINER
// =============================================================================
describe('DEFAULT_TRAINER', () => {
  it('hat die erwartete Shape', () => {
    const trainer: DefaultTrainerShape = DEFAULT_TRAINER;
    expect(trainer).toEqual({ name: null });
  });
});

// =============================================================================
// DEFAULT_SESSION
// =============================================================================
describe('DEFAULT_SESSION', () => {
  it('hat die erwartete Shape', () => {
    const session: DefaultSessionShape = DEFAULT_SESSION;
    expect(session).toEqual({ id: '', timeslot_start: null, timeslot_end: null });
  });
});

// =============================================================================
// Integration: unwrapJoin + DEFAULT_*
// =============================================================================
describe('Integration: unwrapJoin mit DEFAULTs', () => {
  it('Fallback-Pattern wie es in route.ts verwendet wird', () => {
    // Simulates: const court = unwrapJoin(joined) ?? DEFAULT_COURT
    const joinedNull = null;
    const result = unwrapJoin<DefaultCourtShape>(joinedNull) ?? DEFAULT_COURT;
    expect(result).toEqual(DEFAULT_COURT);
    expect(result.name).toBeNull();
  });

  it('gibt das echte Join-Ergebnis zurück wenn vorhanden', () => {
    const real: DefaultCourtShape = { name: 'Court 1', surface: 'clay', number: 3 };
    const result = unwrapJoin<DefaultCourtShape>(real) ?? DEFAULT_COURT;
    expect(result.name).toBe('Court 1');
    expect(result.surface).toBe('clay');
    expect(result.number).toBe(3);
  });
});
