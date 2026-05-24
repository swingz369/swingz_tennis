import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../test-utils';
import MemberListManagement from '@/components/member-list-management';
import SystemSettingsManagement from '@/components/system-settings';
import { SessionBookings } from '@/components/bookings/session-bookings';

// ── Test helpers ──────────────────────────────────────────────────────────

function mockFetch(resolvedData: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => resolvedData,
    text: async () => JSON.stringify(resolvedData),
  });
}

function mockFetchError(status = 500, message = 'Internal server error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message }),
  });
}

const mockUseUserClub = vi.fn();
const mockUseUserMember = vi.fn();
const mockUseUserRoles = vi.fn();

vi.mock('@/hooks/use-user-data', () => ({
  useUserClub: () => mockUseUserClub(),
  useUserMember: () => mockUseUserMember(),
  useUserRoles: () => mockUseUserRoles(),
}));

const mockUseSessions = vi.fn();
const mockCreateBooking = { mutate: vi.fn() };
const mockCancelBooking = { mutate: vi.fn() };
const mockUpdateBookingStatus = { mutate: vi.fn() };

vi.mock('@/hooks/use-sessions', () => ({
  useSessions: (clubId: string | null) => mockUseSessions(clubId),
  useCreateBooking: () => mockCreateBooking,
  useCancelBooking: () => mockCancelBooking,
  useUpdateBookingStatus: () => mockUpdateBookingStatus,
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

// ── MemberListManagement ───────────────────────────────────────────────────

describe('MemberListManagement', () => {
  let fetchSpy: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchSpy = mockFetch({ members: [] });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('clubId prop', () => {
    it('appends clubId to the fetch URL when provided', async () => {
      render(<MemberListManagement clubId="c5d5c5c5-5555-5555-5555-c5d5c5d5c5d5" />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/members?clubId=c5d5c5c5-5555-5555-5555-c5d5c5d5c5d5'
        );
      });
    });

    it('fetches /api/members without clubId when not provided', async () => {
      render(<MemberListManagement />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/members');
      });
    });

    it('URL-encodes the clubId value', async () => {
      render(<MemberListManagement clubId="abc/123?test" />);

      await waitFor(() => {
        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('abc%2F123%3Ftest');
      });
    });
  });

  describe('embedded prop', () => {
    it('hides the standalone header when embedded=true', async () => {
      render(<MemberListManagement clubId="club-1" embedded />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.queryByText('Mitgliederliste verwalten')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Übersicht und Management aller Mitglieder')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Export')).not.toBeInTheDocument();
      expect(screen.queryByText('Neues Mitglied')).not.toBeInTheDocument();
    });

    it('shows the standalone header when embedded=false', async () => {
      render(<MemberListManagement clubId="club-1" embedded={false} />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.getByText('Mitgliederliste verwalten')).toBeInTheDocument();
      expect(screen.getByText('Übersicht und Management aller Mitglieder')).toBeInTheDocument();
    });

    it('shows the standalone header by default (embedded=undefined)', async () => {
      render(<MemberListManagement clubId="club-1" />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.getByText('Mitgliederliste verwalten')).toBeInTheDocument();
    });

    it('renders filters even in embedded mode', async () => {
      render(<MemberListManagement clubId="club-1" embedded />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.getByPlaceholderText('Suche nach Name oder E-Mail...')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner while fetching', () => {
      // Don't resolve the fetch so loading state persists
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

      render(<MemberListManagement clubId="club-1" />);

      expect(screen.getByText('Laden...')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows toast on fetch failure', async () => {
      const fetchSpy = mockFetchError(500);
      vi.stubGlobal('fetch', fetchSpy);

      render(<MemberListManagement clubId="club-1" />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      // Component renders empty list on error — no crash
      expect(screen.queryByText('Laden...')).not.toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalled();
    });
  });
});

// ── SessionBookings ────────────────────────────────────────────────────────

describe('SessionBookings', () => {
  beforeEach(() => {
    mockUseSessions.mockReturnValue({ data: [], isLoading: false });
    mockUseUserClub.mockReturnValue({ data: { clubId: 'hook-club-id' } });
    mockUseUserMember.mockReturnValue({ data: { memberId: 'mem-1' } });
    mockUseUserRoles.mockReturnValue({ data: ['member'] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('clubId prop', () => {
    it('passes the clubId prop to useSessions when provided', () => {
      render(<SessionBookings clubId="prop-club-id" />);

      expect(mockUseSessions).toHaveBeenCalledWith('prop-club-id');
    });

    it('falls back to useUserClub().clubId when no prop provided', () => {
      render(<SessionBookings />);

      expect(mockUseSessions).toHaveBeenCalledWith('hook-club-id');
    });

    it('prioritises the clubId prop over the hook value', () => {
      render(<SessionBookings clubId="override-id" />);

      // The prop value should win
      expect(mockUseSessions).toHaveBeenCalledWith('override-id');
      // Should NOT use the hook value
      expect(mockUseSessions).not.toHaveBeenCalledWith('hook-club-id');
    });

    it('passes null to useSessions when neither prop nor hook has clubId', () => {
      mockUseUserClub.mockReturnValue({ data: { clubId: null } });
      render(<SessionBookings />);

      expect(mockUseSessions).toHaveBeenCalledWith(null);
    });

    it('passes null to useSessions when prop is undefined and hook returns null', () => {
      mockUseUserClub.mockReturnValue({ data: undefined });
      render(<SessionBookings />);

      expect(mockUseSessions).toHaveBeenCalledWith(null);
    });
  });

  describe('rendering', () => {
    it('renders the calendar header', () => {
      render(<SessionBookings clubId="test-club" />);

      expect(screen.getByText('Training Sessions')).toBeInTheDocument();
    });

    it('shows loading state when sessions are loading', () => {
      mockUseSessions.mockReturnValue({ data: undefined, isLoading: true });
      render(<SessionBookings clubId="test-club" />);

      expect(screen.getByText('Laden...')).toBeInTheDocument();
    });

    it('renders calendar day headers', () => {
      mockUseSessions.mockReturnValue({
        data: [
          {
            id: 's1',
            dayOfWeek: 1,
            startTime: '10:00',
            endTime: '11:00',
            trainerId: 't1',
            trainerName: 'Trainer A',
            groupIds: [],
            maxParticipants: 4,
          },
        ],
        isLoading: false,
      });

      render(<SessionBookings clubId="test-club" />);

      expect(screen.getByText('Mo')).toBeInTheDocument();
      expect(screen.getByText('Di')).toBeInTheDocument();
      expect(screen.getByText('Mi')).toBeInTheDocument();
    });
  });
});

// ── SystemSettingsManagement ───────────────────────────────────────────────

describe('SystemSettingsManagement', () => {
  let fetchSpy: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchSpy = mockFetch({ systemSettings: [] });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('clubId prop', () => {
    it('appends clubId to the fetch URL when provided', async () => {
      render(<SystemSettingsManagement clubId="settings-club-id" />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/system-settings?clubId=settings-club-id');
      });
    });

    it('fetches /api/system-settings without clubId when not provided', async () => {
      render(<SystemSettingsManagement />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/system-settings');
      });
    });

    it('URL-encodes the clubId value', async () => {
      render(<SystemSettingsManagement clubId="abc/123?test" />);

      await waitFor(() => {
        const callUrl = fetchSpy.mock.calls[0][0] as string;
        expect(callUrl).toContain('abc%2F123%3Ftest');
      });
    });
  });

  describe('embedded prop', () => {
    it('hides the standalone header when embedded=true', async () => {
      render(<SystemSettingsManagement clubId="club-1" embedded />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.queryByText('System-Einstellungen')).not.toBeInTheDocument();
      expect(screen.queryByText('Verwaltung aller Systemkonfigurationen')).not.toBeInTheDocument();
      expect(screen.queryByText('Export')).not.toBeInTheDocument();
    });

    it('hides the section title when embedded=true', async () => {
      render(<SystemSettingsManagement clubId="club-1" embedded />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.queryByText('Systemeinstellungen')).not.toBeInTheDocument();
    });

    it('shows the standalone header when embedded=false', async () => {
      render(<SystemSettingsManagement clubId="club-1" embedded={false} />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.getByText('System-Einstellungen')).toBeInTheDocument();
      expect(screen.getByText('Verwaltung aller Systemkonfigurationen')).toBeInTheDocument();
    });

    it('shows the section title when embedded=false', async () => {
      render(<SystemSettingsManagement clubId="club-1" embedded={false} />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.getByText('Systemeinstellungen')).toBeInTheDocument();
    });

    it('shows the standalone header by default (embedded=undefined)', async () => {
      render(<SystemSettingsManagement clubId="club-1" />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.getByText('System-Einstellungen')).toBeInTheDocument();
    });

    it('always shows the create-new-setting card', async () => {
      render(<SystemSettingsManagement clubId="club-1" embedded />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(screen.getByText('Neue Systemeinstellung erstellen')).toBeInTheDocument();
    });

    it('renders filters even in embedded mode', async () => {
      render(<SystemSettingsManagement clubId="club-1" embedded />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

      expect(
        screen.getByPlaceholderText('Suche nach Schlüssel oder Beschreibung...')
      ).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner while fetching', () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

      render(<SystemSettingsManagement clubId="club-1" />);

      expect(screen.getByText('Laden...')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows toast on fetch failure', async () => {
      const fetchSpy = mockFetchError(500);
      vi.stubGlobal('fetch', fetchSpy);

      render(<SystemSettingsManagement clubId="club-1" />);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      // Component renders empty list on error — no crash
      expect(screen.queryByText('Laden...')).not.toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalled();
    });
  });
});
