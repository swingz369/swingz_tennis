import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../test-utils';
import { SessionBookings } from '@/components/bookings/session-bookings';

// ── Test helpers ──────────────────────────────────────────────────────────

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

      expect(mockUseSessions).toHaveBeenCalledWith('override-id');
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
