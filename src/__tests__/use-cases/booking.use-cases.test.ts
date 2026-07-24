import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateBookingUseCase,
  CancelBookingUseCase,
  GetMemberBookingsUseCase,
} from '@/application/use-cases/booking.use-cases';

describe('CreateBookingUseCase', () => {
  let mockBookingRepo: any;
  let mockScheduleRepo: any;
  let mockMemberRepo: any;
  let mockClubRepo: any;
  let mockEmailService: any;
  let mockAuditService: any;

  beforeEach(() => {
    mockBookingRepo = {
      save: vi.fn(),
      existsByMemberAndSession: vi.fn().mockResolvedValue(false),
    };
    mockScheduleRepo = { getSessionDetails: vi.fn() };
    mockMemberRepo = {
      getMemberEmailAndName: vi.fn().mockResolvedValue({ email: 'test@test.com', name: 'Test' }),
    };
    mockClubRepo = { findById: vi.fn().mockResolvedValue({ getName: () => 'Test Club' }) };
    mockEmailService = { sendBookingConfirmation: vi.fn() };
    mockAuditService = { log: vi.fn() };
  });

  it('should create booking successfully', async () => {
    mockScheduleRepo.getSessionDetails.mockResolvedValue({
      clubId: { getValue: () => 'club-1', toString: () => 'club-1' } as any,
      scheduleId: { getValue: () => 'sch-1', toString: () => 'sch-1' } as any,
      timeslot: { getStart: () => new Date(), getEnd: () => new Date() },
      maxParticipants: 10,
    });

    const useCase = new CreateBookingUseCase(
      mockBookingRepo,
      mockScheduleRepo,
      mockMemberRepo,
      mockClubRepo,
      mockEmailService,
      mockAuditService
    );
    const result = await useCase.execute({
      memberId: 'member-123',
      sessionId: 'session-456',
    });

    expect(result.bookingId).toBeDefined();
    expect(result.status).toBe('pending');
    expect(mockBookingRepo.save).toHaveBeenCalled();
  });

  it('should fail if session not found', async () => {
    mockScheduleRepo.getSessionDetails.mockResolvedValue(null);
    const useCase = new CreateBookingUseCase(
      mockBookingRepo,
      mockScheduleRepo,
      mockMemberRepo,
      mockClubRepo,
      mockEmailService,
      mockAuditService
    );
    await expect(
      useCase.execute({
        memberId: 'member-123',
        sessionId: 'session-456',
      })
    ).rejects.toThrow('Session with id "session-456" was not found');
  });
});

describe('CancelBookingUseCase', () => {
  let mockBookingRepo: any;
  let mockScheduleRepo: any;
  let mockMemberRepo: any;
  let mockEmailService: any;
  let mockAuditService: any;
  let mockBooking: any;

  beforeEach(() => {
    mockBookingRepo = { findById: vi.fn(), save: vi.fn() };
    mockScheduleRepo = { getSessionDetails: vi.fn() };
    mockMemberRepo = {
      getMemberEmailAndName: vi.fn().mockResolvedValue({ email: 'test@test.com', name: 'Test' }),
    };
    mockEmailService = { sendBookingCancellation: vi.fn() };
    mockAuditService = { log: vi.fn() };
    mockBooking = {
      cancel: vi.fn(),
      getId: () => ({ getValue: () => 'bk-123' }),
      getMemberId: () => ({ getValue: () => 'member-123' }),
      getSessionId: () => ({ getValue: () => 'session-456' }),
    };
    mockBookingRepo.findById.mockResolvedValue(mockBooking);
    mockScheduleRepo.getSessionDetails.mockResolvedValue({
      clubId: { getValue: () => 'club-1', toString: () => 'club-1' } as any,
      scheduleId: { getValue: () => 'sch-1', toString: () => 'sch-1' } as any,
      timeslot: { getStart: () => new Date(), getEnd: () => new Date() },
      maxParticipants: 10,
    });
  });

  it('should cancel booking', async () => {
    const useCase = new CancelBookingUseCase(
      mockBookingRepo,
      mockScheduleRepo,
      mockMemberRepo,
      mockEmailService,
      mockAuditService
    );
    const result = await useCase.execute({
      bookingId: 'bk-123',
      reason: 'member_request',
    });
    expect(result.success).toBe(true);
    expect(mockBooking.cancel).toHaveBeenCalledWith('member_request', undefined);
    expect(mockAuditService.log).toHaveBeenCalled();
  });

  it('should fail if booking not found', async () => {
    mockBookingRepo.findById.mockResolvedValue(null);
    const useCase = new CancelBookingUseCase(
      mockBookingRepo,
      mockScheduleRepo,
      mockMemberRepo,
      mockEmailService,
      mockAuditService
    );
    await expect(
      useCase.execute({
        bookingId: 'bk-999',
        reason: 'member_request',
      })
    ).rejects.toThrow('Booking with id "bk-999" was not found');
  });
});

describe('GetMemberBookingsUseCase', () => {
  let mockBookingRepo: any;

  beforeEach(() => {
    mockBookingRepo = { findByMember: vi.fn() };
  });

  it('should return bookings for member', async () => {
    mockBookingRepo.findByMember.mockResolvedValue([
      {
        getId: () => ({ getValue: () => 'b1' }),
        getSessionId: () => ({ getValue: () => 's1' }),
        getStatus: () => 'confirmed',
        getBookedAt: () => new Date(),
      },
    ]);

    const useCase = new GetMemberBookingsUseCase(mockBookingRepo);
    const result = await useCase.execute({ memberId: 'm1' });
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0].id).toBe('b1');
  });
});
