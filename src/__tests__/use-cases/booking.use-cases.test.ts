import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateBookingUseCase,
  CancelBookingUseCase,
  GetMemberBookingsUseCase,
} from '@/application/use-cases/booking.use-cases';

describe('CreateBookingUseCase', () => {
  let mockBookingRepo: any;
  let mockScheduleRepo: any;

  beforeEach(() => {
    mockBookingRepo = {
      save: vi.fn(),
      existsByMemberAndSession: vi.fn().mockResolvedValue(false),
    };
    mockScheduleRepo = { getSessionDetails: vi.fn() };
  });

  it('should create booking successfully', async () => {
    mockScheduleRepo.getSessionDetails.mockResolvedValue({
      clubId: { toString: () => 'club-1' } as any,
      scheduleId: { toString: () => 'sch-1' } as any,
      timeslot: { getStart: () => new Date(), getEnd: () => new Date() },
      maxParticipants: 10,
    });

    const useCase = new CreateBookingUseCase(mockBookingRepo, mockScheduleRepo);
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
    const useCase = new CreateBookingUseCase(mockBookingRepo, mockScheduleRepo);
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
  let mockBooking: any;

  beforeEach(() => {
    mockBookingRepo = { findById: vi.fn(), save: vi.fn() };
    mockBooking = {
      cancel: vi.fn(),
      getId: () => ({ getValue: () => 'bk-123' }),
      getMemberId: () => ({ getValue: () => 'member-123' }),
    };
    mockBookingRepo.findById.mockResolvedValue(mockBooking);
  });

  it('should cancel booking', async () => {
    const useCase = new CancelBookingUseCase(mockBookingRepo);
    const result = await useCase.execute({
      bookingId: 'bk-123',
      reason: 'member_request',
    });
    expect(result.success).toBe(true);
    expect(mockBooking.cancel).toHaveBeenCalledWith('member_request', undefined);
  });

  it('should fail if booking not found', async () => {
    mockBookingRepo.findById.mockResolvedValue(null);
    const useCase = new CancelBookingUseCase(mockBookingRepo);
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
