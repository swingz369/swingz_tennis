import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBookingStatusUseCase } from '@/application/use-cases/booking-status.use-cases';
import type { BookingRepository } from '@/domain/repositories';
import type { ScheduleRepository } from '@/domain/repositories';
import type { IAuditService, IEmailService } from '@/domain/services';
import { BookingId } from '@/domain/value-objects';

// Mock external services to prevent real Supabase/email calls in tests
vi.mock('@/infrastructure/external/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

// Mock Booking Entity helper
function createMockBooking(
  id: string = 'booking-1',
  sessionId: string = 'session-1',
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' = 'pending'
) {
  return {
    id,
    getSessionId: () => ({ toString: () => sessionId }) as any,
    getStatus: () => status,
  } as any;
}

// Mock Session Details (return value of ScheduleRepository.getSessionDetails)
function createMockSessionDetails(clubId: string = 'club-1') {
  return {
    clubId: { getValue: () => clubId } as any,
  };
}

const createMockBookingRepo = () => ({
  findById: vi.fn(),
  updateStatus: vi.fn(),
});

const createMockScheduleRepo = () => ({
  getSessionDetails: vi.fn(),
});

describe('UpdateBookingStatusUseCase', () => {
  let useCase: UpdateBookingStatusUseCase;
  let mockBookingRepo: ReturnType<typeof createMockBookingRepo>;
  let mockScheduleRepo: ReturnType<typeof createMockScheduleRepo>;

  const bookingId = 'booking-123';
  const sessionClubId = 'club-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingRepo = createMockBookingRepo();
    mockScheduleRepo = createMockScheduleRepo();
    const mockAuditService: IAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      getEntityAuditTrail: vi.fn().mockResolvedValue([]),
      getUserAuditTrail: vi.fn().mockResolvedValue([]),
    };
    const mockEmailService: IEmailService = {
      sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
      sendBookingCancellation: vi.fn().mockResolvedValue(undefined),
      sendSessionReminder: vi.fn().mockResolvedValue(undefined),
      sendInvoice: vi.fn().mockResolvedValue(undefined),
      sendDunningNotice: vi.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordReset: vi.fn().mockResolvedValue(undefined),
      sendCustomEmail: vi.fn().mockResolvedValue(undefined),
      sendBulkEmail: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new UpdateBookingStatusUseCase(
      mockBookingRepo as unknown as BookingRepository,
      mockScheduleRepo as unknown as ScheduleRepository,
      mockAuditService,
      mockEmailService
    );
  });

  it('should update booking status when actor is admin', async () => {
    const booking = createMockBooking(bookingId, 'session-1', 'pending');
    mockBookingRepo.findById.mockResolvedValue(booking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(createMockSessionDetails(sessionClubId));

    const actorClubIds: string[] = ['club-1', 'club-2'];
    const isAdmin = true;

    await useCase.execute(bookingId, 'confirmed', actorClubIds, isAdmin, 'user-123');

    expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith(
      BookingId.fromString(bookingId),
      'confirmed'
    );
  });

  it('should update booking status when trainer is in same club', async () => {
    const booking = createMockBooking(bookingId, 'session-1', 'pending');
    mockBookingRepo.findById.mockResolvedValue(booking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(createMockSessionDetails(sessionClubId));

    const actorClubIds: string[] = ['club-1'];
    const isAdmin = false;

    await useCase.execute(bookingId, 'confirmed', actorClubIds, isAdmin, 'user-123');

    expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith(
      BookingId.fromString(bookingId),
      'confirmed'
    );
  });

  it('should throw Forbidden when trainer is in different club', async () => {
    const booking = createMockBooking(bookingId);
    mockBookingRepo.findById.mockResolvedValue(booking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(createMockSessionDetails(sessionClubId));

    const actorClubIds: string[] = ['club-999'];
    const isAdmin = false;

    await expect(
      useCase.execute(bookingId, 'confirmed', actorClubIds, isAdmin, 'user-123')
    ).rejects.toThrow('Forbidden: no permission for this club');
  });

  it('should throw when booking not found', async () => {
    mockBookingRepo.findById.mockResolvedValue(null);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(createMockSessionDetails());

    const actorClubIds: string[] = ['club-1'];
    const isAdmin = true;

    await expect(
      useCase.execute(bookingId, 'confirmed', actorClubIds, isAdmin, 'user-123')
    ).rejects.toThrow('Booking not found');
  });

  it('should throw when session not found', async () => {
    const booking = createMockBooking(bookingId);
    mockBookingRepo.findById.mockResolvedValue(booking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(null);

    const actorClubIds: string[] = ['club-1'];
    const isAdmin = true;

    await expect(
      useCase.execute(bookingId, 'confirmed', actorClubIds, isAdmin, 'user-123')
    ).rejects.toThrow('Session not found');
  });

  it('should throw when status change invalid (already cancelled)', async () => {
    const booking = createMockBooking(bookingId, 'session-1', 'cancelled');
    mockBookingRepo.findById.mockResolvedValue(booking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(createMockSessionDetails());

    const actorClubIds: string[] = ['club-1'];
    const isAdmin = true;

    await expect(
      useCase.execute(bookingId, 'confirmed', actorClubIds, isAdmin, 'user-123')
    ).rejects.toThrow('Cannot change status from cancelled');
  });

  it('should throw when trying to cancel already cancelled booking', async () => {
    const booking = createMockBooking(bookingId, 'session-1', 'cancelled');
    mockBookingRepo.findById.mockResolvedValue(booking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(createMockSessionDetails());

    const actorClubIds: string[] = ['club-1'];
    const isAdmin = true;

    await expect(
      useCase.execute(bookingId, 'cancelled', actorClubIds, isAdmin, 'user-123')
    ).rejects.toThrow('Already cancelled');
  });

  it('should throw when trying to set no_show twice', async () => {
    const booking = createMockBooking(bookingId, 'session-1', 'no_show');
    mockBookingRepo.findById.mockResolvedValue(booking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue(createMockSessionDetails());

    const actorClubIds: string[] = ['club-1'];
    const isAdmin = true;

    await expect(
      useCase.execute(bookingId, 'no_show', actorClubIds, isAdmin, 'user-123')
    ).rejects.toThrow('Already no_show');
  });
});
