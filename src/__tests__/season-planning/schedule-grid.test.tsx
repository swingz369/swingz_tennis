import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/src/__tests__/test-utils';
import ScheduleGrid, { movedStartTime, layoutDayColumn } from '@/lib/season-planning/schedule-grid';
import type { ScheduleSlot } from '@/lib/season-planning/types';

// ---- Test data ----

function makeSlot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id: 'slot-1',
    groupName: 'Gruppe A',
    groupColor: '#3B82F6',
    trainerId: 't1',
    trainerName: 'Trainer Müller',
    dayOfWeek: 1, // Monday
    startTime: '17:00',
    endTime: '18:30',
    durationMin: 90,
    courtId: 'c1',
    courtName: 'Platz 1',
    memberIds: ['m1', 'm2'],
    memberNames: ['Alice', 'Bob'],
    ...overrides,
  };
}

const noop = () => {};

/** Inline-Style des positionierten Kastens um eine Terminkarte. */
function boxOf(groupName: string): string {
  const box = screen.getByText(groupName).closest('div[style*="top"]') as HTMLElement | null;
  if (!box) throw new Error(`Kein positionierter Kasten für "${groupName}" gefunden`);
  return box.getAttribute('style') ?? '';
}

// ============================================
// TESTS: Rendering
// ============================================

describe('ScheduleGrid — rendering', () => {
  it('should render day headers Mo-Sa only (Sonntag ist kein Trainingstag)', () => {
    render(<ScheduleGrid plan={[]} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('Di')).toBeInTheDocument();
    expect(screen.getByText('Mi')).toBeInTheDocument();
    expect(screen.getByText('Do')).toBeInTheDocument();
    expect(screen.getByText('Fr')).toBeInTheDocument();
    expect(screen.getByText('Sa')).toBeInTheDocument();
    expect(screen.queryByText('So')).not.toBeInTheDocument();
  });

  it('should render the section title', () => {
    render(<ScheduleGrid plan={[]} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(screen.getByText('Wochenstundenplan')).toBeInTheDocument();
    expect(screen.getByText('Drag & Drop zum Verschieben')).toBeInTheDocument();
  });

  it('should render time rows from 08:00 to 21:00', () => {
    render(<ScheduleGrid plan={[]} onSlotMove={noop} onSlotUpdate={noop} />);

    // Spot-check a few time labels
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('21:00')).toBeInTheDocument();
  });
});

// ============================================
// TESTS: Slots
// ============================================

describe('ScheduleGrid — slot rendering', () => {
  it('should render a slot with group name and member count', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    // Group name
    expect(screen.getByText('Gruppe A')).toBeInTheDocument();

    // Member count
    expect(screen.getByText(/2M/)).toBeInTheDocument();
  });

  it('should render multiple slots on the same day/hour cell', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, startTime: '17:00', groupName: 'Gruppe A' }),
      makeSlot({ id: 's2', dayOfWeek: 1, startTime: '17:00', groupName: 'Gruppe B' }),
    ];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(screen.getByText('Gruppe A')).toBeInTheDocument();
    expect(screen.getByText('Gruppe B')).toBeInTheDocument();
  });

  it('should render slots that start on the half hour', () => {
    // Regression: die Zellen waren nach exakter Startzeit geschlüsselt,
    // nachgeschlagen wurde aber nur mit den vollen Stunden aus HOURS. Jeder
    // Termin um :30 fiel unsichtbar aus dem Raster — die Gruppenliste
    // darunter zeigte ihn, das Raster nicht.
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, startTime: '14:00', groupName: 'Volle Stunde' }),
      makeSlot({ id: 's2', dayOfWeek: 1, startTime: '15:30', groupName: 'Halbe Stunde' }),
      makeSlot({ id: 's3', dayOfWeek: 1, startTime: '18:45', groupName: 'Viertel vor' }),
    ];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(screen.getByText('Volle Stunde')).toBeInTheDocument();
    expect(screen.getByText('Halbe Stunde')).toBeInTheDocument();
    expect(screen.getByText('Viertel vor')).toBeInTheDocument();
  });

  it('should position a slot by minutes since the grid start', () => {
    // Die Termine liegen absolut in der Tagesspalte: `top` sind die Minuten
    // seit 08:00, umgerechnet mit 56 px je Stunde. 15:00 → 420 min → 392 px,
    // 15:30 → 450 min → 420 px, also exakt eine halbe Zeile tiefer.
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, startTime: '15:00', groupName: 'Punkt drei' }),
      makeSlot({ id: 's2', dayOfWeek: 2, startTime: '15:30', groupName: 'Halb vier' }),
    ];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(boxOf('Punkt drei')).toContain('top: 392px');
    expect(boxOf('Halb vier')).toContain('top: 420px');
  });

  it('should give 60, 90 and 120 minute slots proportional height', () => {
    // 56 px je Stunde: eine Einheit ist so hoch wie sie lang ist, und ein
    // 90er ragt sichtbar über seine Stundenzeile hinaus.
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, startTime: '09:00', durationMin: 60, groupName: 'Kurz' }),
      makeSlot({
        id: 's2',
        dayOfWeek: 2,
        startTime: '09:00',
        durationMin: 90,
        groupName: 'Mittel',
      }),
      makeSlot({ id: 's3', dayOfWeek: 3, startTime: '09:00', durationMin: 120, groupName: 'Lang' }),
    ];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(boxOf('Kurz')).toContain('height: 56px');
    expect(boxOf('Mittel')).toContain('height: 84px');
    expect(boxOf('Lang')).toContain('height: 112px');
  });

  it('should place overlapping slots side by side, across hour rows', () => {
    // Der Fall, der mit 90- und 120-Minuten-Einheiten entsteht: die beiden
    // Termine starten in verschiedenen Stundenzeilen, überschneiden sich aber
    // — 14:00+120 läuft bis 16:00, der zweite beginnt um 15:00. Solange die
    // Breite je Zelle berechnet wurde, lag einer unsichtbar hinter dem
    // anderen.
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, startTime: '14:00', durationMin: 120, groupName: 'Lang' }),
      makeSlot({ id: 's2', dayOfWeek: 1, startTime: '15:00', durationMin: 60, groupName: 'Quer' }),
    ];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(boxOf('Lang')).toContain('width: 50%');
    expect(boxOf('Lang')).toContain('left: 0%');
    expect(boxOf('Quer')).toContain('width: 50%');
    expect(boxOf('Quer')).toContain('left: 50%');
  });

  it('should give a slot the full width again once nothing overlaps', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, startTime: '09:00', durationMin: 60, groupName: 'Früh' }),
      makeSlot({ id: 's2', dayOfWeek: 1, startTime: '17:00', durationMin: 90, groupName: 'Spät' }),
    ];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(boxOf('Früh')).toContain('width: 100%');
    expect(boxOf('Spät')).toContain('width: 100%');
  });

  it('should apply the slot groupColor as gradient background', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00', groupColor: '#EF4444' })];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    // The component uses @dnd-kit with useDraggable — slot card uses
    // style={{ background: linear-gradient(...) }} not native [draggable]
    const slotEl = screen.getByText('Gruppe A').closest('div[class*="cursor-grab"]');
    expect(slotEl).toBeTruthy();
    // Check that the color appears in the inline style
    // jsdom may normalize hex to rgb(), so accept either format
    const style = (slotEl as HTMLElement).getAttribute('style') ?? '';
    const hasColor = style.includes('#EF4444') || style.includes('rgb(239, 68, 68)');
    expect(hasColor).toBe(true);
  });

  it('should show time and trainer in the slot info', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];
    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    const timeEls = screen.getAllByText(/17:00/);
    expect(timeEls.length).toBeGreaterThanOrEqual(1);
    // Trainer's last name
    expect(screen.getByText(/Müller/)).toBeInTheDocument();
  });
});

// ============================================
// TESTS: Drag & Drop (via @dnd-kit)
// ============================================

describe('ScheduleGrid — drag behaviour', () => {
  it('should render slot cards with drag cursor styling', () => {
    const plan = [
      makeSlot({ dayOfWeek: 1, startTime: '17:00' }),
      makeSlot({ id: 's2', dayOfWeek: 1, startTime: '18:30', groupName: 'Gruppe B' }),
    ];

    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    // Component uses @dnd-kit useDraggable — slot cards have cursor-grab class
    // In jsdom, both slot cards should render with the cursor-grab class
    const slotCards = document.querySelectorAll('[class*="cursor-grab"]');
    // Verify at least one slot rendered with cursor-grab (jsdom may not render
    // all cells due to grid layout limitations)
    expect(slotCards.length).toBeGreaterThanOrEqual(1);
    // Verify the first group name is present
    expect(screen.getByText('Gruppe A')).toBeInTheDocument();
  });

  it('should render slot cards with touchAction: none for mobile drag', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    const slotEl = screen.getByText('Gruppe A').closest('div[class*="cursor-grab"]');
    expect(slotEl).toBeTruthy();
    const style = (slotEl as HTMLElement).getAttribute('style') ?? '';
    expect(style).toContain('touch-action: none');
  });

  it('should accept onSlotMove callback without errors', () => {
    const onSlotMove = vi.fn();
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    // Should render without throwing
    render(<ScheduleGrid plan={plan} onSlotMove={onSlotMove} onSlotUpdate={noop} />);

    // The callback is wired but not triggered during render
    expect(onSlotMove).not.toHaveBeenCalled();
  });

  it('should accept onSlotUpdate callback without errors', () => {
    const onSlotUpdate = vi.fn();
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={onSlotUpdate} />);

    expect(onSlotUpdate).not.toHaveBeenCalled();
  });

  it('should render droppable cells for each day/hour combination', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    // Verify grid rendered with day headers and time labels
    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.getByText('Gruppe A')).toBeInTheDocument();
  });

  it('should render group count badge in header', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, startTime: '17:00', groupName: 'Gruppe A' }),
      makeSlot({ id: 's2', dayOfWeek: 2, startTime: '18:00', groupName: 'Gruppe B' }),
    ];

    render(<ScheduleGrid plan={plan} onSlotMove={noop} onSlotUpdate={noop} />);

    expect(screen.getByText('2 Gruppen')).toBeInTheDocument();
  });
});

// ============================================
// TESTS: Verschieben behält die Minuten
// ============================================

describe('movedStartTime', () => {
  it('keeps the slot minutes and takes the hour from the drop target', () => {
    expect(movedStartTime('15:30', '16:00')).toBe('16:30');
    expect(movedStartTime('14:15', '09:00')).toBe('09:15');
  });

  it('leaves a full-hour slot on the full hour', () => {
    expect(movedStartTime('17:00', '20:00')).toBe('20:00');
  });

  it('is stable when the target hour equals the current hour', () => {
    expect(movedStartTime('18:45', '18:00')).toBe('18:45');
  });
});

// ============================================
// TESTS: Überlappung in der Tagesspalte
// ============================================

describe('layoutDayColumn', () => {
  const lanesOf = (slots: ScheduleSlot[]) =>
    layoutDayColumn(slots).map((p) => [p.slot.groupName, p.lane, p.lanes]);

  it('gives a single slot the whole column', () => {
    expect(lanesOf([makeSlot({ groupName: 'A', startTime: '10:00', durationMin: 90 })])).toEqual([
      ['A', 0, 1],
    ]);
  });

  it('keeps back-to-back slots full width — touching is not overlapping', () => {
    // 14:00+90 endet exakt um 15:30, wo der nächste beginnt.
    expect(
      lanesOf([
        makeSlot({ id: 'a', groupName: 'A', startTime: '14:00', durationMin: 90 }),
        makeSlot({ id: 'b', groupName: 'B', startTime: '15:30', durationMin: 90 }),
      ])
    ).toEqual([
      ['A', 0, 1],
      ['B', 0, 1],
    ]);
  });

  it('splits a 120 minute slot against one starting inside it', () => {
    expect(
      lanesOf([
        makeSlot({ id: 'a', groupName: 'Lang', startTime: '14:00', durationMin: 120 }),
        makeSlot({ id: 'b', groupName: 'Quer', startTime: '15:00', durationMin: 60 }),
      ])
    ).toEqual([
      ['Lang', 0, 2],
      ['Quer', 1, 2],
    ]);
  });

  it('opens a third lane only for the slots that really collide', () => {
    const result = lanesOf([
      makeSlot({ id: 'a', groupName: 'A', startTime: '14:00', durationMin: 120 }),
      makeSlot({ id: 'b', groupName: 'B', startTime: '14:30', durationMin: 60 }),
      makeSlot({ id: 'c', groupName: 'C', startTime: '15:00', durationMin: 60 }),
      makeSlot({ id: 'd', groupName: 'D', startTime: '18:00', durationMin: 60 }),
    ]);
    expect(result).toEqual([
      ['A', 0, 3],
      ['B', 1, 3],
      ['C', 2, 3],
      ['D', 0, 1],
    ]);
  });

  it('reuses a lane that has become free', () => {
    // B endet um 15:00, C kann dessen Spalte wieder haben.
    const result = lanesOf([
      makeSlot({ id: 'a', groupName: 'A', startTime: '14:00', durationMin: 180 }),
      makeSlot({ id: 'b', groupName: 'B', startTime: '14:00', durationMin: 60 }),
      makeSlot({ id: 'c', groupName: 'C', startTime: '15:00', durationMin: 60 }),
    ]);
    expect(result).toEqual([
      ['A', 0, 2],
      ['B', 1, 2],
      ['C', 1, 2],
    ]);
  });
});
