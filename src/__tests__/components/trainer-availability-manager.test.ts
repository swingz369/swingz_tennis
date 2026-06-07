import { describe, it, expect, vi, beforeEach } from 'vitest';
import { format } from 'date-fns';

/* ── Mock apiFetch ── */

const mockApiFetch = vi.fn();
vi.mock('@/lib/api-fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

/* ── Replicated pure logic from trainer-availability-manager.tsx ── */

interface AvailabilitySlot {
  id: string;
  weekday: number;
  fromTime: string;
  untilTime: string;
  isAvailable: boolean;
}

const PRESET_STARTS = ['08:00', '09:30', '11:00', '13:00', '14:30', '16:00', '17:30', '19:00'];

function addCustomSlot(
  slots: AvailabilitySlot[],
  weekday: number,
  now: number = Date.now()
): AvailabilitySlot[] {
  return [
    ...slots,
    {
      id: `custom-${now}`,
      weekday,
      fromTime: '08:00',
      untilTime: '10:00',
      isAvailable: true,
    },
  ];
}

function removeSlotById(slots: AvailabilitySlot[], id: string): AvailabilitySlot[] {
  return slots.filter((s) => s.id !== id);
}

function updateSlotById(
  slots: AvailabilitySlot[],
  id: string,
  field: keyof AvailabilitySlot,
  value: string | number | boolean
): AvailabilitySlot[] {
  return slots.map((s) => (s.id === id ? { ...s, [field]: value } : s));
}

function togglePresetSlot(
  slots: AvailabilitySlot[],
  weekday: number,
  start: string
): AvailabilitySlot[] {
  const [h, m] = start.split(':').map(Number);
  const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const exists = slots.some(
    (s) => s.weekday === weekday && s.fromTime === start && s.untilTime === end
  );
  if (exists) {
    return slots.filter(
      (s) => !(s.weekday === weekday && s.fromTime === start && s.untilTime === end)
    );
  }
  return [
    ...slots,
    {
      id: `preset-${weekday}-${start}`,
      weekday,
      fromTime: start,
      untilTime: end,
      isAvailable: true,
    },
  ];
}

function groupSlotsByDay(slots: AvailabilitySlot[]): Map<number, AvailabilitySlot[]> {
  const map = new Map<number, AvailabilitySlot[]>();
  slots.forEach((slot) => {
    const daySlots = map.get(slot.weekday) || [];
    daySlots.push(slot);
    map.set(slot.weekday, daySlots);
  });
  return map;
}

/* ── Test fixtures ── */

const monSlot: AvailabilitySlot = {
  id: 'preset-1-08:00',
  weekday: 1,
  fromTime: '08:00',
  untilTime: '09:00',
  isAvailable: true,
};

const tueSlot: AvailabilitySlot = {
  id: 'preset-2-11:00',
  weekday: 2,
  fromTime: '11:00',
  untilTime: '12:00',
  isAvailable: true,
};

const customSlot: AvailabilitySlot = {
  id: 'custom-1',
  weekday: 3,
  fromTime: '15:30',
  untilTime: '17:00',
  isAvailable: false,
};

/* ── Tests ── */

describe('addCustomSlot', () => {
  const FIXED_NOW = 1717800000000;

  it('appends a new custom slot with deterministic id from injected timestamp', () => {
    const result = addCustomSlot([monSlot], 4, FIXED_NOW);
    expect(result).toHaveLength(2);
    const added = result[1];
    expect(added.weekday).toBe(4);
    expect(added.fromTime).toBe('08:00');
    expect(added.untilTime).toBe('10:00');
    expect(added.isAvailable).toBe(true);
    expect(added.id).toBe(`custom-${FIXED_NOW}`);
  });

  it('works on empty array', () => {
    const result = addCustomSlot([], 0, FIXED_NOW);
    expect(result).toHaveLength(1);
    expect(result[0].weekday).toBe(0);
    expect(result[0].id).toBe(`custom-${FIXED_NOW}`);
  });

  it('does not mutate the original array', () => {
    const original = [monSlot];
    addCustomSlot(original, 1, FIXED_NOW);
    expect(original).toHaveLength(1);
  });

  it('produces different IDs for different timestamps', () => {
    const resultA = addCustomSlot([], 1, 1000);
    const resultB = addCustomSlot([], 1, 2000);
    expect(resultA[0].id).toBe('custom-1000');
    expect(resultB[0].id).toBe('custom-2000');
  });

  it('falls back to Date.now() when called without explicit timestamp', () => {
    const result = addCustomSlot([], 3);
    expect(result).toHaveLength(1);
    expect(result[0].id).toMatch(/^custom-\d+$/);
    expect(Number(result[0].id.replace('custom-', ''))).toBeGreaterThan(1700000000000);
  });
});

describe('removeSlotById', () => {
  it('removes the slot with matching id', () => {
    const result = removeSlotById([monSlot, tueSlot, customSlot], 'preset-2-11:00');
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(['preset-1-08:00', 'custom-1']);
  });

  it('returns same array when id is not found', () => {
    const result = removeSlotById([monSlot, tueSlot], 'nonexistent');
    expect(result).toHaveLength(2);
    expect(result).toEqual([monSlot, tueSlot]);
  });

  it('returns empty array when removing the only slot', () => {
    const result = removeSlotById([monSlot], 'preset-1-08:00');
    expect(result).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const original = [monSlot, tueSlot];
    removeSlotById(original, 'preset-1-08:00');
    expect(original).toHaveLength(2);
  });
});

describe('updateSlotById', () => {
  it('updates fromTime for the matching slot', () => {
    const result = updateSlotById([monSlot, tueSlot], 'preset-1-08:00', 'fromTime', '09:00');
    expect(result[0].fromTime).toBe('09:00');
    expect(result[0].untilTime).toBe('09:00');
    expect(result[1]).toEqual(tueSlot);
  });

  it('updates untilTime for the matching slot', () => {
    const result = updateSlotById([tueSlot], 'preset-2-11:00', 'untilTime', '13:00');
    expect(result[0].untilTime).toBe('13:00');
    expect(result[0].fromTime).toBe('11:00');
  });

  it('updates isAvailable boolean field', () => {
    const result = updateSlotById([monSlot], 'preset-1-08:00', 'isAvailable', false);
    expect(result[0].isAvailable).toBe(false);
  });

  it('does nothing when id is not found', () => {
    const result = updateSlotById([monSlot], 'nonexistent', 'fromTime', '10:00');
    expect(result[0].fromTime).toBe('08:00');
  });

  it('does not mutate the original array', () => {
    const original = [monSlot];
    updateSlotById(original, 'preset-1-08:00', 'fromTime', '10:00');
    expect(original[0].fromTime).toBe('08:00');
  });
});

describe('togglePresetSlot', () => {
  it('adds a preset slot when it does not exist', () => {
    const result = togglePresetSlot([], 1, '08:00');
    expect(result).toHaveLength(1);
    expect(result[0].weekday).toBe(1);
    expect(result[0].fromTime).toBe('08:00');
    expect(result[0].untilTime).toBe('09:00');
    expect(result[0].isAvailable).toBe(true);
    expect(result[0].id).toBe('preset-1-08:00');
  });

  it('removes a preset slot when it already exists (toggle off)', () => {
    const result = togglePresetSlot([monSlot], 1, '08:00');
    expect(result).toHaveLength(0);
  });

  it('handles 90-minute interval correctly (09:30 → untilTime 10:30)', () => {
    const result = togglePresetSlot([], 3, '09:30');
    expect(result).toHaveLength(1);
    expect(result[0].fromTime).toBe('09:30');
    expect(result[0].untilTime).toBe('10:30');
    expect(result[0].id).toBe('preset-3-09:30');
  });

  it('handles 19:00 → 20:00 boundary correctly', () => {
    const result = togglePresetSlot([], 5, '19:00');
    expect(result).toHaveLength(1);
    expect(result[0].untilTime).toBe('20:00');
  });

  it('only toggles matching weekday+start+end; other slots untouched', () => {
    const result = togglePresetSlot([monSlot, tueSlot], 2, '11:00');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(monSlot);
  });

  it('does not conflate same start-time on different days', () => {
    const afterAdd = togglePresetSlot([], 1, '08:00');
    const result = togglePresetSlot(afterAdd, 5, '08:00');
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.weekday).sort()).toEqual([1, 5]);
    expect(result.every((s) => s.fromTime === '08:00')).toBe(true);
  });
});

describe('groupSlotsByDay', () => {
  it('groups slots by weekday', () => {
    const result = groupSlotsByDay([monSlot, tueSlot, customSlot]);
    expect(result.size).toBe(3);
    expect(result.get(1)).toEqual([monSlot]);
    expect(result.get(2)).toEqual([tueSlot]);
    expect(result.get(3)).toEqual([customSlot]);
  });

  it('groups multiple slots on the same day together', () => {
    const extraMon: AvailabilitySlot = {
      id: 'preset-1-09:30',
      weekday: 1,
      fromTime: '09:30',
      untilTime: '10:30',
      isAvailable: true,
    };
    const result = groupSlotsByDay([monSlot, extraMon, tueSlot]);
    expect(result.size).toBe(2);
    expect(result.get(1)).toHaveLength(2);
    expect(result.get(1)![0].id).toBe('preset-1-08:00');
    expect(result.get(1)![1].id).toBe('preset-1-09:30');
    expect(result.get(2)).toHaveLength(1);
  });

  it('returns empty map for empty input', () => {
    const result = groupSlotsByDay([]);
    expect(result.size).toBe(0);
  });

  it('maintains insertion order within each day group', () => {
    const first: AvailabilitySlot = {
      id: 'slot-a',
      weekday: 1,
      fromTime: '10:00',
      untilTime: '11:00',
      isAvailable: true,
    };
    const second: AvailabilitySlot = {
      id: 'slot-b',
      weekday: 1,
      fromTime: '08:00',
      untilTime: '09:00',
      isAvailable: false,
    };
    const result = groupSlotsByDay([first, second]);
    expect(result.get(1)).toHaveLength(2);
    expect(result.get(1)![0].id).toBe('slot-a');
    expect(result.get(1)![1].id).toBe('slot-b');
  });
});

describe('PRESET_STARTS constant', () => {
  it('contains the expected 8 time slots', () => {
    expect(PRESET_STARTS).toEqual([
      '08:00',
      '09:30',
      '11:00',
      '13:00',
      '14:30',
      '16:00',
      '17:30',
      '19:00',
    ]);
  });
});

/* ── Helpers ── */

function slotDate(weekStart: Date, weekday: number): string {
  const d = new Date(weekStart);
  const offset = weekday === 0 ? 6 : weekday - 1;
  d.setDate(d.getDate() + offset);
  return format(d, 'yyyy-MM-dd');
}

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'basic' as const,
    url: '',
    clone: () => mockResponse(status, body),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(body),
  } as Response;
}

/* ── Replicated async logic (mocked apiFetch) ── */

async function fetchSlots(
  weekStart: Date,
  weekEnd: Date
): Promise<{ slots: AvailabilitySlot[]; message: string | null }> {
  const fromStr = format(weekStart, 'yyyy-MM-dd');
  const toStr = format(weekEnd, 'yyyy-MM-dd');
  const url = `/api/trainer/availability?from=${fromStr}&to=${toStr}`;
  const res = await mockApiFetch(url);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 404) {
      return {
        slots: [],
        message:
          errData.error ?? 'Kein Trainer-Profil gefunden. Bitte wende dich an den Administrator.',
      };
    }
    throw new Error(errData.error ?? 'Fehler beim Laden');
  }
  const data = await res.json();
  const apiSlots: any[] = data.slots || [];
  const converted: AvailabilitySlot[] = apiSlots.map((s: any) => ({
    id: s.id ?? `api-${s.date}-${s.start_time}`,
    weekday: new Date(s.date).getDay(),
    fromTime: s.start_time?.slice(0, 5) ?? '00:00',
    untilTime: s.end_time?.slice(0, 5) ?? '00:00',
    isAvailable: s.status === 'available',
  }));
  return { slots: converted, message: null };
}

/**
 * Replicated saveSlots: GET existing → POST new → DELETE removed.
 */
async function saveSlots(
  slots: AvailabilitySlot[],
  weekStart: Date,
  weekEnd: Date
): Promise<{ message: string }> {
  const fromStr = format(weekStart, 'yyyy-MM-dd');
  const toStr = format(weekEnd, 'yyyy-MM-dd');

  // 1. Fetch existing
  const existingUrl = `/api/trainer/availability?from=${fromStr}&to=${toStr}`;
  let existingData: any = { slots: [] };
  try {
    const existingRes = await mockApiFetch(existingUrl);
    existingData = existingRes.ok
      ? await existingRes.json().catch(() => ({ slots: [] }))
      : { slots: [] };
  } catch {
    /* GET failed → treat as empty */
  }

  const existingKeys = new Set(
    (existingData.slots || []).map(
      (s: any) => `${s.date}|${s.start_time?.slice(0, 5)}|${s.end_time?.slice(0, 5)}`
    )
  );

  // 2. Build UI keys
  const uiKeys = new Set(
    slots.map((s) => `${slotDate(weekStart, s.weekday)}|${s.fromTime}|${s.untilTime}`)
  );

  // 3. DELETE API slots not in UI (DELETE before POST to avoid conflicts)
  let deleted = 0;
  const deleteErrors: string[] = [];
  for (const existing of existingData.slots || []) {
    const ek = `${existing.date}|${existing.start_time?.slice(0, 5)}|${existing.end_time?.slice(0, 5)}`;
    if (!uiKeys.has(ek)) {
      const delRes = await mockApiFetch(`/api/trainer/availability/${existing.id}`, {
        method: 'DELETE',
      });
      if (delRes.ok) {
        deleted++;
      } else if (delRes.status !== 409) {
        deleteErrors.push(`${existing.date}: ${delRes.status}`);
      }
    }
  }

  // 4. POST new slots
  let created = 0;
  let skipped = 0;

  for (const slot of slots) {
    const date = slotDate(weekStart, slot.weekday);
    const key = `${date}|${slot.fromTime}|${slot.untilTime}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const postRes = await mockApiFetch('/api/trainer/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        start_time: slot.fromTime,
        end_time: slot.untilTime,
        notes: null,
      }),
    });

    if (postRes.ok) {
      created++;
    } else if (postRes.status === 409) {
      skipped++;
    } else {
      throw new Error('Fehler beim Speichern');
    }
  }

  // 5. Build message
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} gespeichert`);
  if (skipped > 0) parts.push(`${skipped} bereits vorhanden`);
  if (deleted > 0) parts.push(`${deleted} gelöscht`);

  if (deleteErrors.length > 0) {
    return { message: `Fehler: ${deleteErrors.join('; ')}` };
  }
  if (created === 0 && skipped === 0 && deleted === 0) return { message: 'Keine Änderungen' };
  return { message: `${parts.join(', ')} ✓` };
}

/* ── Fetch tests ── */

describe('fetchSlots (async, mocked apiFetch)', () => {
  const weekStart = new Date(2026, 5, 8);
  const weekEnd = new Date(2026, 5, 14);

  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('returns converted slots on successful fetch (date→weekday conversion)', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          {
            id: 'api-1',
            trainer_id: 't1',
            date: '2026-06-08',
            start_time: '08:00',
            end_time: '09:00',
            status: 'available',
            notes: null,
          },
        ],
      })
    );
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].weekday).toBe(1);
    expect(result.slots[0].fromTime).toBe('08:00');
    expect(result.slots[0].untilTime).toBe('09:00');
    expect(result.slots[0].isAvailable).toBe(true);
    expect(result.message).toBeNull();
  });

  it('maps booked status to isAvailable=false', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          {
            id: 'b1',
            trainer_id: 't1',
            date: '2026-06-09',
            start_time: '11:00',
            end_time: '12:00',
            status: 'booked',
            notes: null,
          },
        ],
      })
    );
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.slots[0].isAvailable).toBe(false);
    expect(result.slots[0].weekday).toBe(2);
  });

  it('includes from/to query params in URL', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    await fetchSlots(weekStart, weekEnd);
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/trainer/availability?from=2026-06-08&to=2026-06-14'
    );
  });

  it('returns empty slots array when response has no slots key', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, {}));
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.slots).toEqual([]);
  });

  it('returns empty slots array when response has null slots', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: null }));
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.slots).toEqual([]);
  });

  it('returns info message on 403 (trainer profile missing)', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(403, { error: 'Kein Trainer-Profil' }));
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.slots).toEqual([]);
    expect(result.message).toBe('Kein Trainer-Profil');
  });

  it('returns default message on 403 when no error body', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(403, {}));
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.message).toContain('Kein Trainer-Profil gefunden');
  });

  it('returns info message on 404 (trainer not found)', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(404, { error: 'Nicht gefunden' }));
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.slots).toEqual([]);
    expect(result.message).toBe('Nicht gefunden');
  });

  it('throws on 500 error', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(500, { error: 'Server-Fehler' }));
    await expect(fetchSlots(weekStart, weekEnd)).rejects.toThrow('Server-Fehler');
  });

  it('throws generic error when response has no error body on server error', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(500, {}));
    await expect(fetchSlots(weekStart, weekEnd)).rejects.toThrow('Fehler beim Laden');
  });

  it('throws on network error (apiFetch rejects)', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network Error'));
    await expect(fetchSlots(weekStart, weekEnd)).rejects.toThrow('Network Error');
  });

  it('calls apiFetch exactly once', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    await fetchSlots(weekStart, weekEnd);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('handles Sunday date correctly (weekday=0)', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          {
            id: 'sun1',
            trainer_id: 't1',
            date: '2026-06-14',
            start_time: '08:00',
            end_time: '09:00',
            status: 'available',
            notes: null,
          },
        ],
      })
    );
    const result = await fetchSlots(weekStart, weekEnd);
    expect(result.slots[0].weekday).toBe(0);
  });
});

/* ── Save tests (with DELETE) ── */

describe('saveSlots (async, mocked apiFetch)', () => {
  const weekStart = new Date(2026, 5, 8);
  const weekEnd = new Date(2026, 5, 14);

  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  const testSlots: AvailabilitySlot[] = [
    { id: 'preset-1-08:00', weekday: 1, fromTime: '08:00', untilTime: '09:00', isAvailable: true },
    { id: 'preset-3-11:00', weekday: 3, fromTime: '11:00', untilTime: '12:00', isAvailable: false },
  ];

  it('saves slots successfully when no existing slots', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new-1' } }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new-2' } }));
    const result = await saveSlots(testSlots, weekStart, weekEnd);
    expect(result.message).toBe('2 gespeichert ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(3); // 1 GET + 2 POSTs
  });

  it('skips duplicates when slots already exist in API', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [{ id: 'dup', date: '2026-06-08', start_time: '08:00', end_time: '09:00' }],
      })
    );
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new' } }));
    const result = await saveSlots(testSlots, weekStart, weekEnd);
    expect(result.message).toBe('1 gespeichert, 1 bereits vorhanden ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('returns skip message when all slots are duplicates (nothing to do)', async () => {
    mockApiFetch.mockResolvedValue(
      mockResponse(200, {
        slots: [
          { id: 'd1', date: '2026-06-08', start_time: '08:00', end_time: '09:00' },
          { id: 'd2', date: '2026-06-10', start_time: '11:00', end_time: '12:00' },
        ],
      })
    );
    const result = await saveSlots(testSlots, weekStart, weekEnd);
    expect(result.message).toBe('2 bereits vorhanden ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('returns "Keine Änderungen" when saving empty with no existing', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    const result = await saveSlots([], weekStart, weekEnd);
    expect(result.message).toBe('Keine Änderungen');
  });

  it('posts individual slots with date computed from weekday', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {}));
    await saveSlots([testSlots[0]], weekStart, weekEnd);
    expect(mockApiFetch).toHaveBeenNthCalledWith(2, '/api/trainer/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-06-08',
        start_time: '08:00',
        end_time: '09:00',
        notes: null,
      }),
    });
  });

  it('handles 409 overlap as skip (not error)', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(409, { error: 'Zeitkonflikt' }));
    const result = await saveSlots([testSlots[0]], weekStart, weekEnd);
    expect(result.message).toBe('1 bereits vorhanden ✓');
  });

  it('throws on non-409 server error during POST', async () => {
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(500, {}));
    await expect(saveSlots([testSlots[0]], weekStart, weekEnd)).rejects.toThrow(
      'Fehler beim Speichern'
    );
  });

  it('handles GET failure gracefully (treats as empty existing)', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('GET failed'));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new' } }));
    const result = await saveSlots([testSlots[0]], weekStart, weekEnd);
    expect(result.message).toBe('1 gespeichert ✓');
  });

  // ── DELETE tests ──────────────────────────────────────────────────────

  it('deletes API slots that are no longer in the UI', async () => {
    // GET: 2 API slots exist (Mon + Tue)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          { id: 'api-1', date: '2026-06-08', start_time: '08:00', end_time: '09:00' },
          { id: 'api-2', date: '2026-06-09', start_time: '11:00', end_time: '12:00' },
        ],
      })
    );
    // UI only has Monday slot → Tuesday slot will be detected as removed → DELETE
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true })); // DELETE api-2

    const uiSlots = [testSlots[0]]; // only Monday
    const result = await saveSlots(uiSlots, weekStart, weekEnd);

    expect(result.message).toContain('1 bereits vorhanden'); // Mon already exists
    expect(result.message).toContain('1 gelöscht'); // Tue deleted
    // 1 GET + 1 DELETE = 2 calls
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/trainer/availability/api-2', {
      method: 'DELETE',
    });
  });

  it('deletes multiple removed slots', async () => {
    // GET: 3 API slots
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          { id: 'api-1', date: '2026-06-08', start_time: '08:00', end_time: '09:00' },
          { id: 'api-2', date: '2026-06-09', start_time: '11:00', end_time: '12:00' },
          { id: 'api-3', date: '2026-06-10', start_time: '13:00', end_time: '14:00' },
        ],
      })
    );
    // DELETE api-2
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));
    // DELETE api-3
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));

    const uiSlots = [testSlots[0]]; // only Monday
    const result = await saveSlots(uiSlots, weekStart, weekEnd);

    expect(result.message).toBe('1 bereits vorhanden, 2 gelöscht ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(3); // 1 GET + 2 DELETEs
  });

  it('silently skips deleting booked slots (409 from API)', async () => {
    // GET: 2 API slots
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          { id: 'api-1', date: '2026-06-08', start_time: '08:00', end_time: '09:00' },
          { id: 'api-2', date: '2026-06-09', start_time: '11:00', end_time: '12:00' },
        ],
      })
    );
    // DELETE api-2 → 409 (booked)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(409, { error: 'Gebuchter Slot kann nicht gelöscht werden' })
    );

    const uiSlots = [testSlots[0]];
    const result = await saveSlots(uiSlots, weekStart, weekEnd);

    // No "gelöscht" in message — 409 is silently ignored
    expect(result.message).toBe('1 bereits vorhanden ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('clears all slots (UI empty, API had slots)', async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          { id: 'api-1', date: '2026-06-08', start_time: '08:00', end_time: '09:00' },
          { id: 'api-2', date: '2026-06-09', start_time: '11:00', end_time: '12:00' },
        ],
      })
    );
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));

    const result = await saveSlots([], weekStart, weekEnd);
    expect(result.message).toBe('2 gelöscht ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
  });

  it('reports non-409 DELETE failures as visible error message', async () => {
    // GET: 2 API slots (Mon + Tue)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          { id: 'api-1', date: '2026-06-08', start_time: '08:00', end_time: '09:00' },
          { id: 'api-2', date: '2026-06-09', start_time: '11:00', end_time: '12:00' },
        ],
      })
    );
    // DELETE api-2 → 500 (non-409 error → should be visible)
    mockApiFetch.mockResolvedValueOnce(mockResponse(500, { error: 'Datenbankfehler' }));

    const uiSlots = [testSlots[0]]; // only Monday
    const result = await saveSlots(uiSlots, weekStart, weekEnd);

    expect(result.message).toContain('Fehler');
    expect(result.message).toContain('2026-06-09');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('combines create, skip, and delete in one save', async () => {
    // GET: 3 API slots — Mon 08:00 (keep/skip), Tue 11:00 (delete), Wed 10:00 (delete)
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [
          { id: 'api-1', date: '2026-06-08', start_time: '08:00', end_time: '09:00' },
          { id: 'api-2', date: '2026-06-09', start_time: '11:00', end_time: '12:00' },
          { id: 'api-3', date: '2026-06-10', start_time: '10:00', end_time: '11:00' },
        ],
      })
    );
    // DELETE api-2 (Tue) — now BEFORE POSTs
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));
    // DELETE api-3 (Wed)
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { success: true }));
    // POST for new slot (Thu 09:30)
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new-1' } }));

    // UI: Mon 08:00 (existing) + Thu 09:30 (new)
    const uiSlots: AvailabilitySlot[] = [
      testSlots[0], // Monday 08:00 — already exists → skip
      {
        id: 'preset-4-09:30',
        weekday: 4,
        fromTime: '09:30',
        untilTime: '10:30',
        isAvailable: true,
      },
    ];
    const result = await saveSlots(uiSlots, weekStart, weekEnd);

    expect(result.message).toBe('1 gespeichert, 1 bereits vorhanden, 2 gelöscht ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(4); // 1 GET + 1 POST + 2 DELETEs
  });
});

/* ── getWeeksInMonth (pure date math) ── */

describe('getWeeksInMonth', () => {
  /** Replica: get all Monday dates for weeks overlapping with a month. */
  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getWeeksInMonth(year: number, month: number): Date[] {
    const weeks: Date[] = [];
    const firstMonday = getMonday(new Date(year, month, 1));
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const monday = new Date(firstMonday);
    while (
      format(monday, 'yyyy-MM-dd') <= format(lastDayOfMonth, 'yyyy-MM-dd') &&
      weeks.length < 6
    ) {
      weeks.push(new Date(monday));
      monday.setDate(monday.getDate() + 7);
    }
    return weeks;
  }

  it('returns 5 Mondays for June 2026 (June 1 = Monday)', () => {
    const weeks = getWeeksInMonth(2026, 5); // June 2026
    // June 1 = Monday → weeks: Jun 1, 8, 15, 22, 29
    expect(weeks.length).toBe(5);
    expect(format(weeks[0], 'yyyy-MM-dd')).toBe('2026-06-01');
    expect(format(weeks[4], 'yyyy-MM-dd')).toBe('2026-06-29');
  });

  it('returns correct Mondays for February 2026 (starts Sun)', () => {
    const weeks = getWeeksInMonth(2026, 1); // Feb 2026
    // Feb 1 = Sunday → first Monday = Jan 26
    expect(weeks[0].getMonth()).toBe(0); // January
    expect(weeks[0].getDate()).toBe(26);
    // All Mondays are sequential (7 days apart)
    for (let i = 1; i < weeks.length; i++) {
      const diff = (weeks[i].getTime() - weeks[i - 1].getTime()) / 86400000;
      expect(diff).toBe(7);
    }
  });

  it('limits to max 6 weeks', () => {
    // March 2026 spans at most 5 weeks starting Monday
    const weeks = getWeeksInMonth(2026, 2);
    expect(weeks.length).toBeLessThanOrEqual(6);
  });

  it('each result is a Monday', () => {
    const weeks = getWeeksInMonth(2026, 5);
    for (const w of weeks) {
      expect(w.getDay()).toBe(1); // Monday
    }
  });
});

/* ── applyToAllWeeksInMonth (async, mocked apiFetch) ── */

async function fetchExistingKeysReplica(weekStart: Date): Promise<Set<string>> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  try {
    const res = await mockApiFetch(
      `/api/trainer/availability?from=${format(weekStart, 'yyyy-MM-dd')}&to=${format(weekEnd, 'yyyy-MM-dd')}`
    );
    const data = res.ok ? await res.json().catch(() => ({ slots: [] })) : { slots: [] };
    return new Set(
      (data.slots || []).map(
        (s: any) => `${s.date}|${s.start_time?.slice(0, 5)}|${s.end_time?.slice(0, 5)}`
      )
    );
  } catch {
    return new Set();
  }
}

async function applyToAllWeeksInMonth(
  slots: AvailabilitySlot[],
  month: number,
  year: number,
  currentWeekStart: Date
): Promise<{ message: string; created: number; skipped: number }> {
  const weeks: Date[] = [];
  const getMondayLocal = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const firstMonday = getMondayLocal(new Date(year, month, 1));
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const monday = new Date(firstMonday);
  while (format(monday, 'yyyy-MM-dd') <= format(lastDayOfMonth, 'yyyy-MM-dd') && weeks.length < 6) {
    weeks.push(new Date(monday));
    monday.setDate(monday.getDate() + 7);
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  const errorDates: string[] = [];

  for (const weekStart of weeks) {
    if (format(weekStart, 'yyyy-MM-dd') === format(currentWeekStart, 'yyyy-MM-dd')) continue;

    const existingKeys = await fetchExistingKeysReplica(weekStart);

    for (const slot of slots) {
      const date = slotDate(weekStart, slot.weekday);
      const key = `${date}|${slot.fromTime}|${slot.untilTime}`;
      if (existingKeys.has(key)) {
        totalSkipped++;
        continue;
      }

      const res = await mockApiFetch('/api/trainer/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          start_time: slot.fromTime,
          end_time: slot.untilTime,
          notes: null,
        }),
      });

      if (res.ok) {
        totalCreated++;
      } else if (res.status === 409) {
        totalSkipped++;
      } else {
        errorDates.push(date);
      }
    }
  }

  const parts: string[] = [];
  if (totalCreated > 0) parts.push(`${totalCreated} Slots erstellt`);
  if (totalSkipped > 0) parts.push(`${totalSkipped} bereits vorhanden`);
  if (errorDates.length > 0) parts.push(`${errorDates.length} Fehler`);

  if (parts.length === 0)
    return { message: 'Alle Wochen im Monat bereits konfiguriert', created: 0, skipped: 0 };
  return { message: `${parts.join(', ')} ✓`, created: totalCreated, skipped: totalSkipped };
}

describe('applyToAllWeeksInMonth (async, mocked apiFetch)', () => {
  const currentWeekStart = new Date(2026, 5, 8); // Monday June 8 2026

  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  const testSlots: AvailabilitySlot[] = [
    { id: 'preset-1-08:00', weekday: 1, fromTime: '08:00', untilTime: '09:00', isAvailable: true },
  ];

  it('creates slots for all weeks except current week', async () => {
    // June 2026: 5 weeks (Jun 1, 8, 15, 22, 29) — current=Jun 8 skipped → 4 non-current
    // Each: 1 GET + 1 POST = 8 calls
    for (let i = 0; i < 4; i++) {
      mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] })); // GET
      mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: `new-${i}` } })); // POST
    }

    const result = await applyToAllWeeksInMonth(testSlots, 5, 2026, currentWeekStart);

    expect(result.created).toBe(4); // 4 weeks × 1 slot
    expect(result.skipped).toBe(0);
    expect(result.message).toBe('4 Slots erstellt ✓');
    expect(mockApiFetch).toHaveBeenCalledTimes(8);
  });

  it('skips duplicate slots that already exist in target weeks', async () => {
    // June 2026: 4 non-current weeks (Jun 1, 15, 22, 29)
    // Week 1 (Jun 1): GET returns existing → skip
    mockApiFetch.mockResolvedValueOnce(
      mockResponse(200, {
        slots: [{ id: 'dup', date: '2026-06-01', start_time: '08:00', end_time: '09:00' }],
      })
    );
    // Week 2 (Jun 15): empty → POST
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new-1' } }));
    // Week 3 (Jun 22): empty → POST
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new-2' } }));
    // Week 4 (Jun 29): empty → POST
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'new-3' } }));

    const result = await applyToAllWeeksInMonth(testSlots, 5, 2026, currentWeekStart);

    expect(result.created).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.message).toBe('3 Slots erstellt, 1 bereits vorhanden ✓');
  });

  it('returns message when all weeks are already configured', async () => {
    // 4 non-current weeks with correct Monday dates: Jun 1, 15, 22, 29
    const weekDates = ['2026-06-01', '2026-06-15', '2026-06-22', '2026-06-29'];
    for (const date of weekDates) {
      mockApiFetch.mockResolvedValueOnce(
        mockResponse(200, {
          slots: [
            {
              id: `dup-${date}`,
              date,
              start_time: '08:00',
              end_time: '09:00',
            },
          ],
        })
      );
    }

    const result = await applyToAllWeeksInMonth(testSlots, 5, 2026, currentWeekStart);

    expect(result.message).toBe('4 bereits vorhanden ✓');
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(4);
  });

  it('treats GET failure as empty existing (creates anyway)', async () => {
    // June 2026: 4 non-current weeks. Week 1 GET fails → POST fallback
    mockApiFetch.mockRejectedValueOnce(new Error('GET failed'));
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: 'fallback-1' } }));
    // Weeks 2-4: empty → POST each
    for (let i = 0; i < 3; i++) {
      mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
      mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: `new-${i}` } }));
    }

    const result = await applyToAllWeeksInMonth(testSlots, 5, 2026, currentWeekStart);

    expect(result.created).toBe(4); // GET failure doesn't block creation
  });

  it('handles 409 as skip during POST', async () => {
    // 4 non-current weeks: all GET empty, all POST return 409
    for (let i = 0; i < 4; i++) {
      mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
      mockApiFetch.mockResolvedValueOnce(mockResponse(409, { error: 'Zeitkonflikt' }));
    }

    const result = await applyToAllWeeksInMonth(testSlots, 5, 2026, currentWeekStart);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(4);
    expect(result.message).toBe('4 bereits vorhanden ✓');
  });

  it('posts slots with correct date for each weekday', async () => {
    // June 2026: 4 non-current weeks (Jun 1, 15, 22, 29)
    // 2 slots each → 4 weeks × 2 slots = 8 POSTs
    const multiSlots: AvailabilitySlot[] = [
      { id: 'a', weekday: 1, fromTime: '08:00', untilTime: '09:00', isAvailable: true },
      { id: 'b', weekday: 3, fromTime: '11:00', untilTime: '12:00', isAvailable: true },
    ];

    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] })); // GET week Jun 1
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Mon Jun 1
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Wed Jun 3
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] })); // GET week Jun 15
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Mon Jun 15
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Wed Jun 17
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] })); // GET week Jun 22
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Mon Jun 22
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Wed Jun 24
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] })); // GET week Jun 29
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Mon Jun 29
    mockApiFetch.mockResolvedValueOnce(mockResponse(201, {})); // POST Wed Jul 1

    const result = await applyToAllWeeksInMonth(multiSlots, 5, 2026, currentWeekStart);

    expect(result.created).toBe(8); // 4 non-current weeks × 2 slots
    // Verify Monday Jun 1 POST
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/trainer/availability',
      expect.objectContaining({
        body: expect.stringContaining('"date":"2026-06-01"'),
      })
    );
    // Verify Wednesday Jun 3 POST
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/trainer/availability',
      expect.objectContaining({
        body: expect.stringContaining('"date":"2026-06-03"'),
      })
    );
  });

  it('collects non-409 POST errors and reports count', async () => {
    // June 2026: 4 non-current weeks. Week 1 POST fails → others succeed
    mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
    mockApiFetch.mockResolvedValueOnce(mockResponse(500, { error: 'Server error' }));
    for (let i = 0; i < 3; i++) {
      mockApiFetch.mockResolvedValueOnce(mockResponse(200, { slots: [] }));
      mockApiFetch.mockResolvedValueOnce(mockResponse(201, { slot: { id: `ok-${i}` } }));
    }

    const result = await applyToAllWeeksInMonth(testSlots, 5, 2026, currentWeekStart);

    expect(result.created).toBe(3); // 3 successful weeks
    expect(result.message).toContain('1 Fehler');
  });
});
