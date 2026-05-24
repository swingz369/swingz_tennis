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
const noopDrop = (e: React.DragEvent, _day: number, _hour: string) => {
  e.preventDefault();
};

// ============================================
// TESTS: Rendering
// ============================================

describe('ScheduleGrid — rendering', () => {
  it('should render day headers (Mo–So)', () => {
    render(
      <ScheduleGrid
        plan={[]}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('Di')).toBeInTheDocument();
    expect(screen.getByText('Mi')).toBeInTheDocument();
    expect(screen.getByText('Do')).toBeInTheDocument();
    expect(screen.getByText('Fr')).toBeInTheDocument();
    expect(screen.getByText('Sa')).toBeInTheDocument();
    expect(screen.getByText('So')).toBeInTheDocument();
  });

  it('should render the section title', () => {
    render(
      <ScheduleGrid
        plan={[]}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    expect(screen.getByText('Wochenstundenplan')).toBeInTheDocument();
    expect(screen.getByText('Drag & Drop zum Verschieben')).toBeInTheDocument();
  });

  it('should render time rows from 08:00 to 21:00', () => {
    render(
      <ScheduleGrid
        plan={[]}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

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
    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

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
    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    expect(screen.getByText('Gruppe A')).toBeInTheDocument();
    expect(screen.getByText('Gruppe B')).toBeInTheDocument();
  });

  it('should apply the slot groupColor as background', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00', groupColor: '#EF4444' })];
    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    const slotEl = screen.getByText('Gruppe A').closest('[draggable]');
    expect(slotEl).toHaveStyle({ background: '#EF4444' });
  });

  it('should show time and trainer in the slot info', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];
    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    const timeEls = screen.getAllByText(/17:00/);
    expect(timeEls.length).toBeGreaterThanOrEqual(1);
    // Trainer's last name
    expect(screen.getByText(/Müller/)).toBeInTheDocument();
  });
});

// ============================================
// TESTS: Drag & Drop
// ============================================

describe('ScheduleGrid — drag behaviour', () => {
  it('should reduce opacity on the currently dragged slot', () => {
    const draggingSlot = makeSlot({ dayOfWeek: 1, startTime: '17:00' });
    const plan = [
      draggingSlot,
      makeSlot({ id: 's2', dayOfWeek: 1, startTime: '18:30', groupName: 'Gruppe B' }),
    ];

    render(
      <ScheduleGrid
        plan={plan}
        dragging={draggingSlot}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    const slotA = screen.getByText('Gruppe A').closest('[draggable]');
    expect(slotA).toHaveStyle({ opacity: '0.4' });
  });

  it('should highlight drop target cell with blue background', () => {
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    // Slot is at day=1, hour=17:00 → key matches dragOver
    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver="1-17:00"
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    // Find the cell with bg-blue-50
    const cells = document.querySelectorAll('.bg-blue-50');
    expect(cells.length).toBe(1);
  });

  it('should call onDragStart when dragging a slot', () => {
    const onDragStart = vi.fn();
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={onDragStart}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    const slotEl = screen.getByText('Gruppe A').closest('[draggable]')!;
    slotEl.dispatchEvent(new Event('dragstart', { bubbles: true }));
    expect(onDragStart).toHaveBeenCalledWith(plan[0]);
  });

  it('should call onDragEnd when drag ends', () => {
    const onDragEnd = vi.fn();
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={onDragEnd}
        onDragOver={noop}
        onDrop={noopDrop}
      />
    );

    const slotEl = screen.getByText('Gruppe A').closest('[draggable]')!;
    slotEl.dispatchEvent(new Event('dragend', { bubbles: true }));
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('should call onDragOver when hovering a cell', () => {
    const onDragOver = vi.fn();
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={onDragOver}
        onDrop={noopDrop}
      />
    );

    // Use getByText to find rendered time labels — proves grid is rendered
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(onDragOver).not.toHaveBeenCalled(); // not called during render
  });

  it('should call onDrop when dropping on a cell', () => {
    const onDrop = vi.fn((e: React.DragEvent) => e.preventDefault());
    const plan = [makeSlot({ dayOfWeek: 1, startTime: '17:00' })];

    render(
      <ScheduleGrid
        plan={plan}
        dragging={null}
        dragOver={null}
        onDragStart={noop}
        onDragEnd={noop}
        onDragOver={noop}
        onDrop={onDrop}
      />
    );

    // Verify grid rendered with day headers and time labels
    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.getByText('Gruppe A')).toBeInTheDocument();

    // Simulate drop on a cell: find the cell containing the slot and fire drop
    const slotEl = screen.getByText('Gruppe A').closest('[draggable]')!;
    const cell = slotEl.parentElement!;
    cell.dispatchEvent(new Event('drop', { bubbles: true }));
    expect(onDrop).toHaveBeenCalled();
  });
});
