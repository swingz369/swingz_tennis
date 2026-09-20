import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import AttendanceHistory from '@/components/attendance-history';

// ── Helpers ────────────────────────────────────────────────────────────
const makeRecords = (count: number, attended = true) =>
  Array.from({ length: count }, (_, i) => ({
    id: `rec-${i + 1}`,
    session_id: `sess-${i + 1}`,
    member_name: `Member ${i + 1}`,
    session_date: '2025-06-01',
    start_time: '10:00:00',
    end_time: '11:00:00',
    court: `Court ${(i % 3) + 1}`,
    attended: i % 2 === 0 ? attended : !attended,
    notes: '',
  }));

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe('AttendanceHistory', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Loading state ────────────────────────────────────────────────────
  it('shows loading skeleton initially', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}) // never resolves
    );
    render(<AttendanceHistory />);

    expect(screen.getByRole('status', { name: 'Wird geladen' })).toBeInTheDocument();
  });

  // ── Data rendering ───────────────────────────────────────────────────
  it('renders attendance records after fetch', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ records: makeRecords(3), total: 3 })
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(screen.getByText('Court 1')).toBeInTheDocument();
      expect(screen.getByText('Court 2')).toBeInTheDocument();
      expect(screen.getByText('Court 3')).toBeInTheDocument();
    });
  });

  // ── Stats cards ──────────────────────────────────────────────────────
  it('renders stats cards with correct labels', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ records: makeRecords(4), total: 4 })
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(screen.getByText('Gesamt')).toBeInTheDocument();
      // "Anwesend" and "Verpasst" appear in stats + filter buttons + badges
      expect(screen.getAllByText('Anwesend').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Verpasst').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Quote')).toBeInTheDocument();
    });
  });

  // ── Empty state ──────────────────────────────────────────────────────
  it('shows empty state when no records', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ records: [], total: 0 })
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(screen.getByText(/keine einträge gefunden/i)).toBeInTheDocument();
    });
  });

  // ── Error state ──────────────────────────────────────────────────────
  it('shows error message on fetch failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response)
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Laden')).toBeInTheDocument();
    });
  });

  // ── Filter buttons ───────────────────────────────────────────────────
  it('renders filter buttons', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ records: makeRecords(2), total: 2 })
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /alle/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /anwesend/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verpasst/i })).toBeInTheDocument();
    });
  });

  it('refetches with filter param when filter is clicked', async () => {
    const fetchMock = vi.fn();
    (globalThis.fetch as ReturnType<typeof vi.fn>) = fetchMock;

    fetchMock.mockReturnValue(jsonResponse({ records: makeRecords(2), total: 2 }));

    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /anwesend/i }));

    await waitFor(() => {
      const secondCallUrl = fetchMock.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain('filter=attended');
      expect(secondCallUrl).toContain('page=1');
    });
  });

  // ── PaginationNav integration ────────────────────────────────────────
  it('does not render PaginationNav when ≤1 page', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ records: makeRecords(5), total: 5 })
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      // "Court 1" appears in multiple records — verify at least one exists
      expect(screen.getAllByText(/Court 1/).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.queryByRole('button', { name: /nächste seite/i })).not.toBeInTheDocument();
  });

  it('renders PaginationNav when >1 page', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ records: makeRecords(15), total: 45 })
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(screen.getAllByText(/Court 1/).length).toBeGreaterThanOrEqual(1);
    });

    // PaginationNav in compact mode shows prev/next
    expect(screen.getByRole('button', { name: /nächste seite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vorherige seite/i })).toBeDisabled();
  });

  it('fetches page 2 when next page is clicked', async () => {
    const fetchMock = vi.fn();
    (globalThis.fetch as ReturnType<typeof vi.fn>) = fetchMock;

    // Page 1
    fetchMock.mockReturnValueOnce(jsonResponse({ records: makeRecords(15), total: 45 }));
    // Page 2
    fetchMock.mockReturnValueOnce(jsonResponse({ records: makeRecords(15), total: 45 }));

    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(screen.getAllByText(/Court 1/).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /nächste seite/i }));

    await waitFor(() => {
      const page2Url = fetchMock.mock.calls[1][0] as string;
      expect(page2Url).toContain('page=2');
    });
  });

  it('resets to page 1 when filter changes', async () => {
    const fetchMock = vi.fn();
    (globalThis.fetch as ReturnType<typeof vi.fn>) = fetchMock;

    // Initial load page 1
    fetchMock.mockReturnValueOnce(jsonResponse({ records: makeRecords(15), total: 45 }));
    // Page 2 load
    fetchMock.mockReturnValueOnce(jsonResponse({ records: makeRecords(15), total: 45 }));
    // Filter change resets to page 1
    fetchMock.mockReturnValueOnce(jsonResponse({ records: makeRecords(5), total: 5 }));

    render(<AttendanceHistory />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Navigate to page 2
    fireEvent.click(screen.getByRole('button', { name: /nächste seite/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // Click filter — should reset to page 1
    fireEvent.click(screen.getByRole('button', { name: /verpasst/i }));

    await waitFor(() => {
      const filterCallUrl = fetchMock.mock.calls[2][0] as string;
      expect(filterCallUrl).toContain('page=1');
      expect(filterCallUrl).toContain('filter=missed');
    });
  });

  // ── Badge rendering ──────────────────────────────────────────────────
  it('renders attended/absent badges correctly', async () => {
    const records = [
      { ...makeRecords(1)[0], attended: true },
      { ...makeRecords(1)[0], id: 'rec-2', attended: false },
    ];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ records, total: 2 })
    );
    render(<AttendanceHistory />);

    await waitFor(() => {
      // "Anwesend" appears in stats, filter button, and badge — verify at least 3 occurrences
      expect(screen.getAllByText('Anwesend').length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('Abwesend')).toBeInTheDocument();
    });
  });
});
