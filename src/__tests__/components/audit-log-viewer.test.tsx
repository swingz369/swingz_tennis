import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import { AuditLogViewer } from '@/components/admin/audit-log-viewer';

// ── Mock sonner toast ──────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────
const makeLogs = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `log-${i + 1}`,
    action: i % 2 === 0 ? 'create' : 'update',
    entity_type: 'member',
    entity_id: `entity-${i + 1}`,
    user_id: `user-${i + 1}`,
    user_email: `user${i + 1}@test.de`,
    changes: {},
    ip_address: null,
    user_agent: null,
    created_at: new Date().toISOString(),
  }));

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe('AuditLogViewer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Loading state ────────────────────────────────────────────────────
  it('shows loading state initially', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}) // never resolves
    );
    render(<AuditLogViewer />);
    expect(screen.getByText(/loading audit logs/i)).toBeInTheDocument();
  });

  // ── Data rendering ───────────────────────────────────────────────────
  it('renders log entries after fetch', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ logs: makeLogs(2), total: 2 })
    );
    render(<AuditLogViewer />);

    await waitFor(() => {
      expect(screen.getByText('user1@test.de')).toBeInTheDocument();
      expect(screen.getByText('user2@test.de')).toBeInTheDocument();
    });
  });

  // ── Empty state ──────────────────────────────────────────────────────
  it('shows empty state when no logs', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ logs: [], total: 0 })
    );
    render(<AuditLogViewer />);

    await waitFor(() => {
      expect(screen.getByText(/no audit logs found/i)).toBeInTheDocument();
    });
  });

  // ── PaginationNav integration ────────────────────────────────────────
  it('does not render PaginationNav when ≤1 page', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ logs: makeLogs(5), total: 5 })
    );
    render(<AuditLogViewer />);

    await waitFor(() => {
      expect(screen.getByText('user1@test.de')).toBeInTheDocument();
    });

    // PaginationNav returns null when totalPages <= 1
    expect(screen.queryByRole('button', { name: /nächste seite/i })).not.toBeInTheDocument();
  });

  it('renders PaginationNav when >1 page', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ logs: makeLogs(50), total: 120 })
    );
    render(<AuditLogViewer />);

    await waitFor(() => {
      expect(screen.getByText('user1@test.de')).toBeInTheDocument();
    });

    // PaginationNav in compact mode shows prev/next buttons
    expect(screen.getByRole('button', { name: /nächste seite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vorherige seite/i })).toBeDisabled();
  });

  it('calls fetch with correct offset when navigating to page 2', async () => {
    const fetchMock = vi.fn();
    (globalThis.fetch as ReturnType<typeof vi.fn>) = fetchMock;

    // Page 1 response
    fetchMock.mockReturnValueOnce(jsonResponse({ logs: makeLogs(50), total: 120 }));
    // Page 2 response
    fetchMock.mockReturnValueOnce(jsonResponse({ logs: makeLogs(50), total: 120 }));

    render(<AuditLogViewer />);

    await waitFor(() => {
      expect(screen.getByText('user1@test.de')).toBeInTheDocument();
    });

    // Click next page
    const nextBtn = screen.getByRole('button', { name: /nächste seite/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      // Second call should have offset=50 (page 2)
      const secondCall = fetchMock.mock.calls[1][0] as string;
      expect(secondCall).toContain('offset=50');
    });
  });

  it('passes clubId as query parameter when provided', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ logs: makeLogs(1), total: 1 })
    );
    render(<AuditLogViewer clubId="club-abc" />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('club_id=club-abc');
  });

  // ── Refresh button ───────────────────────────────────────────────────
  it('refetches logs when Refresh is clicked', async () => {
    const fetchMock = vi.fn();
    (globalThis.fetch as ReturnType<typeof vi.fn>) = fetchMock;
    fetchMock.mockReturnValue(jsonResponse({ logs: makeLogs(1), total: 1 }));

    render(<AuditLogViewer />);

    await waitFor(() => {
      expect(screen.getByText('user1@test.de')).toBeInTheDocument();
    });

    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // ── Error handling ───────────────────────────────────────────────────
  it('shows toast error on fetch failure', async () => {
    const { toast } = await import('sonner');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response)
    );
    render(<AuditLogViewer />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load audit logs');
    });
  });
});
