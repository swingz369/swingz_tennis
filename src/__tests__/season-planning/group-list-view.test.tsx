import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/src/__tests__/test-utils';
import GroupListView from '@/lib/season-planning/group-list-view';
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

function makeByDay(plan: ScheduleSlot[]): Record<number, ScheduleSlot[]> {
  const result: Record<number, ScheduleSlot[]> = {};
  for (let d = 1; d <= 7; d++) result[d] = [];
  plan.forEach((s) => {
    const day = s.dayOfWeek === 0 ? 7 : s.dayOfWeek;
    if (!result[day]) result[day] = [];
    result[day].push(s);
  });
  return result;
}

// ============================================
// TESTS: Empty state
// ============================================

describe('GroupListView — empty state', () => {
  it('should show empty message when plan is empty', () => {
    render(
      <GroupListView
        plan={[]}
        expandedSlot={null}
        byDay={{ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }}
        activeDays={[]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Kein Plan generiert')).toBeInTheDocument();
  });
});

// ============================================
// TESTS: Groups by day
// ============================================

describe('GroupListView — groups by day', () => {
  it('should render day headers for active days', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, groupName: 'Gruppe A' }),
      makeSlot({ id: 's2', dayOfWeek: 2, groupName: 'Gruppe B' }),
    ];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1, 2]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    // Day labels (Montag, Dienstag)
    expect(screen.getByText('Montag')).toBeInTheDocument();
    expect(screen.getByText('Dienstag')).toBeInTheDocument();

    // Day abbreviations (Mo, Di) inside the colored badge
    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('Di')).toBeInTheDocument();
  });

  it('should render group names', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1, groupName: 'Gruppe A' })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Gruppe A')).toBeInTheDocument();
  });

  it('should show group count per day', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, groupName: 'Gruppe A' }),
      makeSlot({ id: 's2', dayOfWeek: 1, groupName: 'Gruppe B' }),
    ];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText(/2 Gruppen/)).toBeInTheDocument();
  });

  it('should show singular "Gruppe" for one group', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1 })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText(/1 Gruppe/)).toBeInTheDocument();
  });

  it('should show total member count per day', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['A', 'B'] })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText(/2 Mitglieder gesamt/)).toBeInTheDocument();
  });
});

// ============================================
// TESTS: Slot info
// ============================================

describe('GroupListView — slot metadata', () => {
  it('should display time range and trainer per slot', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1, startTime: '17:00', endTime: '18:30' })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText(/17:00–18:30 Uhr/)).toBeInTheDocument();
    expect(screen.getByText(/Trainer Müller/)).toBeInTheDocument();
    expect(screen.getByText(/Platz 1/)).toBeInTheDocument();
  });

  it('should show slot color dot', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1, groupColor: '#EF4444' })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    const colorDot = document.querySelector('.rounded-full.flex-shrink-0');
    expect(colorDot).toBeInTheDocument();
    expect(colorDot).toHaveStyle({ background: '#ef4444' });
  });
});

// ============================================
// TESTS: Member chips
// ============================================

describe('GroupListView — member chips', () => {
  it('should render member name chips', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['Alice', 'Bob', 'Charlie'] })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('should show "Keine Mitglieder" for empty slot', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1, memberNames: [], memberIds: [] })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Keine Mitglieder')).toBeInTheDocument();
  });
});

// ============================================
// TESTS: Expand / collapse
// ============================================

describe('GroupListView — expand/collapse', () => {
  it('should show "Mitglieder verschieben" button', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1 })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Mitglieder verschieben')).toBeInTheDocument();
  });

  it('should show "Schließen" when slot is expanded', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1 })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot="s1"
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Schließen')).toBeInTheDocument();
  });

  it('should call onToggleExpand with slot id when clicking expand', () => {
    const onToggleExpand = vi.fn();
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1 })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={onToggleExpand}
        onMoveMember={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Mitglieder verschieben'));
    expect(onToggleExpand).toHaveBeenCalledWith('s1');
  });

  it('should call onToggleExpand with empty string when collapsing', () => {
    const onToggleExpand = vi.fn();
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1 })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot="s1"
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={onToggleExpand}
        onMoveMember={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Schließen'));
    expect(onToggleExpand).toHaveBeenCalledWith('');
  });
});

// ============================================
// TESTS: Move member UI
// ============================================

describe('GroupListView — move member UI', () => {
  it('should show transfer UI when slot is expanded', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['Alice'], memberIds: ['m1'] }),
      makeSlot({
        id: 's2',
        dayOfWeek: 1,
        groupName: 'Gruppe B',
        memberNames: ['Bob'],
        memberIds: ['m2'],
      }),
    ];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot="s1"
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Mitglied in andere Gruppe verschieben:')).toBeInTheDocument();
  });

  it('should show target group options in the select dropdown', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['Alice'], memberIds: ['m1'] }),
      makeSlot({ id: 's2', dayOfWeek: 1, groupName: 'Gruppe B', memberNames: [], memberIds: [] }),
    ];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot="s1"
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    // "Gruppe B" appears as a group header
    expect(screen.getByText(/Gruppe B/)).toBeInTheDocument();

    // Open the shadcn Select to verify options appear in the portal
    const triggers = screen.getAllByRole('combobox');
    fireEvent.click(triggers[triggers.length - 1]);

    // Options should now be visible in the portal
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(1);
    const hasGruppeBOption = options.some((o) => o.textContent?.includes('Gruppe B'));
    expect(hasGruppeBOption).toBe(true);
  });

  it('should NOT include the current slot in target options', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['Alice'], memberIds: ['m1'] }),
      makeSlot({
        id: 's2',
        dayOfWeek: 1,
        groupName: 'Gruppe B',
        memberNames: ['Bob'],
        memberIds: ['m2'],
      }),
    ];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot="s1"
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    // Open the shadcn Select to see options
    const triggers = screen.getAllByRole('combobox');
    fireEvent.click(triggers[triggers.length - 1]);

    // "Gruppe A" (current slot) should not appear as a target
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    const hasCurrentGroup = optionTexts.some((t) => t?.includes('Gruppe A'));
    expect(hasCurrentGroup).toBe(false);
  });

  it('should call onMoveMember when selecting a target', () => {
    const onMoveMember = vi.fn();
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['Alice'], memberIds: ['m1'] }),
      makeSlot({ id: 's2', dayOfWeek: 1, groupName: 'Gruppe B', memberNames: [], memberIds: [] }),
    ];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot="s1"
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={onMoveMember}
      />
    );

    // Open the shadcn Select to reveal options
    const triggers = screen.getAllByRole('combobox');
    fireEvent.click(triggers[triggers.length - 1]);

    // Find and click the target option (Gruppe B / s2)
    const options = screen.getAllByRole('option');
    const targetOption = options.find(
      (o) => o.textContent?.includes('Gruppe B') && o.getAttribute('data-value') !== 'placeholder'
    );
    expect(targetOption).toBeTruthy();
    fireEvent.click(targetOption!);

    expect(onMoveMember).toHaveBeenCalledWith('s1', 'm1', 'Alice', 's2');
  });

  it('should show each member in the transfer list', () => {
    const plan = [
      makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['Alice', 'Bob'], memberIds: ['m1', 'm2'] }),
    ];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot="s1"
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    // Both members should appear in the transfer UI
    const transferSection = screen
      .getByText('Mitglied in andere Gruppe verschieben:')
      .closest('div')!;
    expect(transferSection.textContent).toContain('Alice');
    expect(transferSection.textContent).toContain('Bob');
  });

  it('should not show transfer UI when slot is not expanded', () => {
    const plan = [makeSlot({ id: 's1', dayOfWeek: 1, memberNames: ['Alice'], memberIds: ['m1'] })];
    const byDay = makeByDay(plan);

    render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    expect(screen.queryByText('Mitglied in andere Gruppe verschieben:')).not.toBeInTheDocument();
  });
});

// ============================================
// TESTS: Sorting
// ============================================

describe('GroupListView — slot sorting', () => {
  it('should sort slots by startTime within a day', () => {
    const plan = [
      makeSlot({ id: 'late', dayOfWeek: 1, startTime: '18:30', groupName: 'Späte Gruppe' }),
      makeSlot({ id: 'early', dayOfWeek: 1, startTime: '17:00', groupName: 'Frühe Gruppe' }),
    ];
    const byDay = makeByDay(plan);

    const { container } = render(
      <GroupListView
        plan={plan}
        expandedSlot={null}
        byDay={byDay}
        activeDays={[1]}
        onToggleExpand={vi.fn()}
        onMoveMember={vi.fn()}
      />
    );

    // The groups section: find the group name texts and check order
    // The component uses text-foreground (Tailwind) not text-gray-900
    const groupNames = container.querySelectorAll('.font-medium.text-foreground.text-sm');
    const names = Array.from(groupNames).map((el) => el.textContent);
    // "Frühe Gruppe" (17:00) should come before "Späte Gruppe" (18:30)
    expect(names).toHaveLength(2);
    expect(names[0]).toBe('Frühe Gruppe');
    expect(names[1]).toBe('Späte Gruppe');
  });
});
