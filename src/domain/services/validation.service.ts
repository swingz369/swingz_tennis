import type { Club } from '../entities/club';

export class ValidationService {
  public static validateClubCreation(
    name: string,
    maxMembers: number,
    openingHours: Club['openingHours']
  ): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Club name is required');
    }
    if (name.trim().length > 200) {
      throw new Error('Club name cannot exceed 200 characters');
    }
    if (maxMembers <= 0) {
      throw new Error('Max members must be positive');
    }
    if (maxMembers > 10000) {
      throw new Error('Max members cannot exceed 10000');
    }
    this.validateOpeningHours(openingHours);
  }

  public static validateOpeningHours(openingHours: Club['openingHours']): boolean {
    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ] as const;

    for (const day of days) {
      const hours = openingHours[day];
      if (!hours || !hours.open || !hours.close) {
        throw new Error(`Opening hours for ${day} are required`);
      }

      const [openHour, openMin] = hours.open.split(':').map(Number);
      const [closeHour, closeMin] = hours.close.split(':').map(Number);

      if (isNaN(openHour) || isNaN(openMin) || isNaN(closeHour) || isNaN(closeMin)) {
        throw new Error(`Invalid time format for ${day}`);
      }

      const open = openHour * 60 + openMin;
      const close = closeHour * 60 + closeMin;

      if (open < 0 || open > 23 * 60 + 59) {
        throw new Error(`Invalid opening time for ${day}`);
      }
      if (close < 0 || close > 23 * 60 + 59) {
        throw new Error(`Invalid closing time for ${day}`);
      }
      if (open >= close) {
        throw new Error(`Closing time must be after opening time on ${day}`);
      }
    }
    return true;
  }

  public static validateTrainer(
    name: string,
    email: string,
    specialties: string[],
    maxHoursPerWeek: number
  ): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Trainer name is required');
    }
    if (name.trim().length > 100) {
      throw new Error('Trainer name cannot exceed 100 characters');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }
    if (specialties.length === 0) {
      throw new Error('At least one specialty is required');
    }
    if (maxHoursPerWeek <= 0 || maxHoursPerWeek > 50) {
      throw new Error('Max hours per week must be between 1 and 50');
    }
  }

  public static validateMemberAddition(club: Club, memberId: string): void {
    if (club.getStatus() !== 'active') {
      throw new Error('Cannot add member to inactive club');
    }
    if (club.getMembers().some((m) => m.getValue() === memberId)) {
      throw new Error('Member already registered in this club');
    }
    if (club.getMemberCount() >= club.getMaxMembers()) {
      throw new Error('Club has reached maximum member capacity');
    }
  }

  public static validateSession(
    trainerId: string,
    timeslot: { start: Date; end: Date },
    maxParticipants: number
  ): void {
    if (!trainerId) {
      throw new Error('Trainer ID is required');
    }
    if (!timeslot.start || !timeslot.end) {
      throw new Error('Time slot start and end are required');
    }
    if (timeslot.start >= timeslot.end) {
      throw new Error('Session start must be before end');
    }
    if (maxParticipants <= 0 || maxParticipants > 50) {
      throw new Error('Max participants must be between 1 and 50');
    }
  }

  public static validateBooking(memberId: string, sessionId: string, bookingTime: Date): void {
    if (!memberId) {
      throw new Error('Member ID is required');
    }
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    if (!bookingTime) {
      throw new Error('Booking time is required');
    }
  }

  public static isActive(club: Club): boolean {
    return club.getStatus() === 'active';
  }
}
