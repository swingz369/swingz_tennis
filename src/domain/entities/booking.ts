import { BookingId, ClubId, MemberId, ScheduleId, SessionId } from '../value-objects';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type CancellationReason = 'trainer_unavailable' | 'member_request' | 'weather' | 'other';

export interface BookingCancellation {
  reason: CancellationReason;
  notes?: string;
  cancelledAt: Date;
}

export class Booking {
  private readonly id: BookingId;
  private clubId: ClubId;
  private memberId: MemberId;
  private scheduleId: ScheduleId;
  private sessionId: SessionId;
  private status: BookingStatus;
  private bookedAt: Date;
  private cancelledAt?: Date;
  private cancellationReason?: CancellationReason;
  private cancellationNotes?: string;

  private constructor(
    id: BookingId,
    clubId: ClubId,
    memberId: MemberId,
    scheduleId: ScheduleId,
    sessionId: SessionId
  ) {
    this.id = id;
    this.clubId = clubId;
    this.memberId = memberId;
    this.scheduleId = scheduleId;
    this.sessionId = sessionId;
    this.status = 'pending';
    this.bookedAt = new Date();
  }

  public static create(
    clubId: ClubId,
    memberId: MemberId,
    scheduleId: ScheduleId,
    sessionId: SessionId
  ): Booking {
    return new Booking(BookingId.create(), clubId, memberId, scheduleId, sessionId);
  }

  public static reconstitute(
    id: BookingId,
    clubId: ClubId,
    memberId: MemberId,
    scheduleId: ScheduleId,
    sessionId: SessionId,
    status: BookingStatus,
    bookedAt: Date,
    cancelledAt?: Date,
    cancellationReason?: CancellationReason,
    cancellationNotes?: string
  ): Booking {
    const booking = new Booking(id, clubId, memberId, scheduleId, sessionId);
    booking.status = status;
    booking.bookedAt = bookedAt;
    if (cancelledAt) booking.cancelledAt = cancelledAt;
    if (cancellationReason) booking.cancellationReason = cancellationReason;
    if (cancellationNotes) booking.cancellationNotes = cancellationNotes;
    return booking;
  }

  public getId(): BookingId {
    return this.id;
  }

  public getClubId(): ClubId {
    return this.clubId;
  }

  public getMemberId(): MemberId {
    return this.memberId;
  }

  public getScheduleId(): ScheduleId {
    return this.scheduleId;
  }

  public getSessionId(): SessionId {
    return this.sessionId;
  }

  public getStatus(): BookingStatus {
    return this.status;
  }

  public confirm(): void {
    if (this.status !== 'pending') {
      throw new Error(`Cannot confirm booking in status: ${this.status}`);
    }
    this.status = 'confirmed';
  }

  public cancel(reason: CancellationReason, notes?: string): void {
    if (this.status === 'cancelled' || this.status === 'completed') {
      throw new Error(`Cannot cancel booking in status: ${this.status}`);
    }
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    if (notes !== undefined) {
      this.cancellationNotes = notes;
    }
  }

  public complete(): void {
    if (this.status !== 'confirmed') {
      throw new Error(`Cannot complete booking in status: ${this.status}`);
    }
    this.status = 'completed';
  }

  public isCancellable(): boolean {
    // Can cancel if pending or confirmed, and session hasn't started yet
    if (this.status !== 'pending' && this.status !== 'confirmed') {
      return false;
    }
    const hoursUntilSession = this.getHoursUntilSession();
    return hoursUntilSession > 0; // Can cancel if session hasn't started
  }

  public getCancellationPolicy(): {
    requiresApproval: boolean;
    refundPercentage: number;
    cancellationFee: number;
  } {
    const hoursUntilSession = this.getHoursUntilSession();

    if (hoursUntilSession > 24) {
      return {
        requiresApproval: false,
        refundPercentage: 100,
        cancellationFee: 0,
      };
    } else if (hoursUntilSession > 2) {
      return {
        requiresApproval: true,
        refundPercentage: 50,
        cancellationFee: 5,
      };
    } else {
      return {
        requiresApproval: false,
        refundPercentage: 0,
        cancellationFee: 10,
      };
    }
  }

  public getBookedAt(): Date {
    return new Date(this.bookedAt);
  }

  public getCancelledAt(): Date | undefined {
    return this.cancelledAt ? new Date(this.cancelledAt) : undefined;
  }

  public getCancellationReason(): CancellationReason | undefined {
    return this.cancellationReason;
  }

  public getCancellationNotes(): string | undefined {
    return this.cancellationNotes;
  }

  private getHoursUntilSession(): number {
    const now = new Date();
    return (this.bookedAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  }
}
