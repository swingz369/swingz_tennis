import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/src/__tests__/test-utils';
import ScheduleReadinessCheck from '@/lib/season-planning/readiness-check';

// ---- Mock fetch ----
vi.stubGlobal('fetch', vi.fn());

function mockFetchResponse(
  overrides: {
    planningMembers?: number;
    trainerCount?: number;
    availabilityCount?: number;
    courtCount?: number;
    preferenceCount?: number;
  } = {}
) {
  const data = {
    planningMembers: overrides.planningMembers ?? 0,
    trainerCount: overrides.trainerCount ?? 0,
    availabilityCount: overrides.availabilityCount ?? 0,
    courtCount: overrides.courtCount ?? 0,
    preferenceCount: overrides.preferenceCount ?? 0,
  };
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

describe('ScheduleReadinessCheck — loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  });

  it('should render nothing while fetch is pending', () => {
    const { container } = render(
      <ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />
    );
    expect(container.textContent).toBe('');
  });
});

describe('ScheduleReadinessCheck — errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponse({ planningMembers: 0, trainerCount: 2, availabilityCount: 3, courtCount: 2 });
  });

  it('should show error when no planning members', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Problem/)).toBeInTheDocument());
    const members = screen.getAllByText(/0 Mitglieder für Planung/);
    expect(members.length).toBeGreaterThanOrEqual(1);
  });

  it('should call onReady(false) when errors exist', async () => {
    const onReady = vi.fn();
    mockFetchResponse({ planningMembers: 0, trainerCount: 0, availabilityCount: 0, courtCount: 0 });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(false));
  });

  it('should show XCircle icon in red', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(document.querySelector('.text-red-600')).toBeInTheDocument());
  });

  it('should have red background on error', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(document.querySelector('.bg-red-50')).toBeInTheDocument());
  });
});

describe('ScheduleReadinessCheck — all OK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponse({
      planningMembers: 5,
      trainerCount: 2,
      availabilityCount: 3,
      courtCount: 2,
      preferenceCount: 10,
    });
  });

  it('should show "Bereit für Planung" when all required pass', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Bereit für Planung')).toBeInTheDocument());
  });

  it('should call onReady(true)', async () => {
    const onReady = vi.fn();
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(true));
  });

  it('should show green background', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(document.querySelector('.bg-green-50')).toBeInTheDocument());
  });
});

describe('ScheduleReadinessCheck — warnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponse({
      planningMembers: 5,
      trainerCount: 2,
      availabilityCount: 3,
      courtCount: 2,
      preferenceCount: 0,
    });
  });

  it('should show warning chip for missing preferences', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/0 Mitglieder-Präferenzen/)).toBeInTheDocument());
  });

  it('should still show "Bereit" when only warnings', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Bereit für Planung')).toBeInTheDocument());
  });

  it('should show amber background for warning chip', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(document.querySelector('.bg-amber-100')).toBeInTheDocument());
  });
});

describe('ScheduleReadinessCheck — details panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show "Details" button', async () => {
    mockFetchResponse({
      planningMembers: 5,
      trainerCount: 2,
      availabilityCount: 3,
      courtCount: 2,
      preferenceCount: 10,
    });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Details')).toBeInTheDocument());
  });

  it('should expand details and show hints', async () => {
    mockFetchResponse({ planningMembers: 0, trainerCount: 0, availabilityCount: 0, courtCount: 0 });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => fireEvent.click(screen.getByText('Details')));
    expect(screen.getByText(/Aktiviere bei Mitgliedern/)).toBeInTheDocument();
  });

  it('should toggle to "Schließen" when expanded', async () => {
    mockFetchResponse({
      planningMembers: 5,
      trainerCount: 2,
      availabilityCount: 3,
      courtCount: 2,
      preferenceCount: 0,
    });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => fireEvent.click(screen.getByText('Details')));
    expect(screen.getByText('Schließen')).toBeInTheDocument();
  });

  it('should collapse on "Schließen" click', async () => {
    mockFetchResponse({
      planningMembers: 5,
      trainerCount: 2,
      availabilityCount: 3,
      courtCount: 2,
      preferenceCount: 0,
    });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => fireEvent.click(screen.getByText('Details')));
    fireEvent.click(screen.getByText('Schließen'));
    expect(screen.queryByText(/Optional: Mitglieder können/)).not.toBeInTheDocument();
  });

  it('should show links in expanded details', async () => {
    mockFetchResponse({ planningMembers: 0, trainerCount: 2, availabilityCount: 3, courtCount: 2 });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => fireEvent.click(screen.getByText('Details')));
    const link = screen.getByText('Mitglieder verwalten');
    expect(link.closest('a')).toHaveAttribute('href', '/admin/members');
  });

  it('should show "Alle Voraussetzungen erfüllt" when expanded and all OK', async () => {
    mockFetchResponse({
      planningMembers: 5,
      trainerCount: 2,
      availabilityCount: 3,
      courtCount: 2,
      preferenceCount: 10,
    });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => fireEvent.click(screen.getByText('Details')));
    expect(screen.getByText(/Alle Voraussetzungen erfüllt/)).toBeInTheDocument();
  });
});

describe('ScheduleReadinessCheck — chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponse({
      planningMembers: 8,
      trainerCount: 3,
      availabilityCount: 4,
      courtCount: 3,
      preferenceCount: 12,
    });
  });

  it('should render all 4 check chips', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/8 Mitglieder für Planung/)).toBeInTheDocument();
      expect(screen.getByText(/4 Trainer-Präferenzen/)).toBeInTheDocument();
      expect(screen.getByText(/3 Plätze für Trainingsplanung/)).toBeInTheDocument();
      expect(screen.getByText(/12 Mitglieder-Präferenzen/)).toBeInTheDocument();
    });
  });

  it('should show green chips for OK items', async () => {
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() =>
      expect(document.querySelectorAll('.bg-green-100').length).toBeGreaterThanOrEqual(3)
    );
  });

  it('should show red chips for error items', async () => {
    mockFetchResponse({ planningMembers: 0, trainerCount: 0, availabilityCount: 0, courtCount: 0 });
    render(<ScheduleReadinessCheck clubId="club-1" seasonId="season-1" onReady={vi.fn()} />);
    await waitFor(() => expect(document.querySelectorAll('.bg-red-100').length).toBe(2));
  });
});
