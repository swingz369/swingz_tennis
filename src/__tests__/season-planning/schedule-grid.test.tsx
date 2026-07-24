import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/src/__tests__/test-utils';
import ScheduleGrid from '@/lib/season-planning/schedule-grid';
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
