import type {
  Court,
  CourtType,
  CourtAvailability,
  Booking,
  BookingRule,
  WaitlistEntry,
  CreateCourt,
  CreateWaitlistEntry,
  CreateBookingRule,
  BookingStatus,
  WaitlistStatus,
  CourtStatus,
  TimeSlot,
  DayAvailability,
  CourtSchedule,
  BookingConflict,
} from './types/court-booking';
import { CourtService } from './booking/court.service';
import { BookingService } from './booking/booking.service';
import { WaitlistService } from './booking/waitlist.service';
import { ScheduleService } from './booking/schedule.service';

export class CourtBookingEngine {
  private static instance: CourtBookingEngine;
  private courtService = CourtService.getInstance();
  private bookingService = BookingService.getInstance();
  private waitlistService = WaitlistService.getInstance();
  private scheduleService = ScheduleService.getInstance();

  private constructor() {}

  public static getInstance(): CourtBookingEngine {
    if (!CourtBookingEngine.instance) {
      CourtBookingEngine.instance = new CourtBookingEngine();
    }
    return CourtBookingEngine.instance;
  }

  async createCourt(data: CreateCourt): Promise<Court> {
    return this.courtService.createCourt(data);
  }

  async getCourtById(courtId: string): Promise<Court | null> {
    return this.courtService.getCourtById(courtId);
  }

  async getCourtsByClub(
    clubId: string,
    filters?: {
      status?: CourtStatus;
      isActive?: boolean;
    }
  ): Promise<Court[]> {
    return this.courtService.getCourtsByClub(clubId, filters);
  }

  async updateCourtStatus(courtId: string, status: CourtStatus): Promise<Court> {
    return this.courtService.updateCourtStatus(courtId, status);
  }

  async getCourtTypes(): Promise<CourtType[]> {
    return this.courtService.getCourtTypes();
  }

  async getBookingById(bookingId: string): Promise<Booking | null> {
    return this.bookingService.getBookingById(bookingId);
  }

  async getBookingsByUser(
    userId: string,
    filters?: {
      status?: BookingStatus;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Booking[]> {
    return this.bookingService.getBookingsByUser(userId, filters);
  }

  async getBookingsByCourt(
    courtId: string,
    filters?: {
      status?: BookingStatus;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Booking[]> {
    return this.bookingService.getBookingsByCourt(courtId, filters);
  }

  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    metadata?: {
      cancelled_at?: string;
      cancellation_reason?: string;
    }
  ): Promise<Booking> {
    return this.bookingService.updateBookingStatus(bookingId, status, metadata);
  }

  async checkBookingAvailability(
    courtId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    return this.bookingService.checkBookingAvailability(
      courtId,
      startTime,
      endTime,
      excludeBookingId
    );
  }

  async getBookingConflicts(
    courtId: string,
    startTime: string,
    endTime: string
  ): Promise<BookingConflict[]> {
    return this.bookingService.getBookingConflicts(courtId, startTime, endTime);
  }

  async createWaitlistEntry(
    data: CreateWaitlistEntry,
    userId: string,
    clubId: string
  ): Promise<WaitlistEntry> {
    return this.waitlistService.createWaitlistEntry(data, userId, clubId);
  }

  async getWaitlistEntriesByUser(
    userId: string,
    filters?: {
      status?: WaitlistStatus;
    }
  ): Promise<WaitlistEntry[]> {
    return this.waitlistService.getWaitlistEntriesByUser(userId, filters);
  }

  async getWaitlistEntriesByCourt(
    courtId: string,
    filters?: {
      status?: WaitlistStatus;
    }
  ): Promise<WaitlistEntry[]> {
    return this.waitlistService.getWaitlistEntriesByCourt(courtId, filters);
  }

  async updateWaitlistStatus(
    entryId: string,
    status: WaitlistStatus,
    metadata?: {
      offered_at?: string;
      expires_at?: string;
    }
  ): Promise<WaitlistEntry> {
    return this.waitlistService.updateWaitlistStatus(entryId, status, metadata);
  }

  async processWaitlist(
    courtId: string,
    startTime: string,
    endTime: string
  ): Promise<WaitlistEntry[]> {
    return this.waitlistService.processWaitlist(
      courtId,
      startTime,
      endTime,
      this.bookingService.checkBookingAvailability.bind(this.bookingService)
    );
  }

  async getBookingRule(clubId: string): Promise<BookingRule | null> {
    return this.scheduleService.getBookingRule(clubId);
  }

  async createBookingRule(data: CreateBookingRule): Promise<BookingRule> {
    return this.scheduleService.createBookingRule(data);
  }

  async getCourtAvailability(
    courtId: string,
    startDate: string,
    endDate: string
  ): Promise<CourtAvailability[]> {
    return this.scheduleService.getCourtAvailability(courtId, startDate, endDate);
  }

  async getAvailableTimeSlots(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    slotDurationMinutes?: number
  ): Promise<TimeSlot[]> {
    return this.scheduleService.getAvailableTimeSlots(
      courtId,
      date,
      startTime,
      endTime,
      slotDurationMinutes
    );
  }

  async getDayAvailability(courtId: string, date: string): Promise<DayAvailability> {
    return this.scheduleService.getDayAvailability(courtId, date);
  }

  async getCourtSchedule(
    courtId: string,
    startDate: string,
    endDate: string
  ): Promise<CourtSchedule> {
    return this.scheduleService.getCourtSchedule(courtId, startDate, endDate);
  }

  async validateBookingRules(
    userId: string,
    clubId: string,
    startTime: string,
    endTime: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    return this.scheduleService.validateBookingRules(userId, clubId, startTime, endTime);
  }
}

export const courtBookingEngine = CourtBookingEngine.getInstance();
