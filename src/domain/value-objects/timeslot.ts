import { isAfter, isBefore, isEqual } from 'date-fns';

export class TimeSlot {
  private readonly start: Date;
  private readonly end: Date;

  constructor(start: Date, end: Date) {
    if (!start || !end) {
      throw new Error('Start and end times are required');
    }

    if (!(start instanceof Date) || !(end instanceof Date)) {
      throw new Error('Start and end must be Date objects');
    }

    if (isAfter(start, end) || isEqual(start, end)) {
      throw new Error('Start time must be before end time');
    }

    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (durationMinutes <= 0 || durationMinutes > 480) {
      throw new Error('TimeSlot duration must be between 1 minute and 8 hours');
    }

    this.start = start;
    this.end = end;
  }

  public getStart(): Date {
    return new Date(this.start);
  }

  public getEnd(): Date {
    return new Date(this.end);
  }

  public getDurationMinutes(): number {
    return (this.end.getTime() - this.start.getTime()) / (1000 * 60);
  }

  public overlaps(other: TimeSlot): boolean {
    return this.start < other.end && this.end > other.start;
  }

  public contains(date: Date): boolean {
    return date >= this.start && date < this.end;
  }

  public isOnSameDay(other: TimeSlot): boolean {
    return this.start.toDateString() === other.start.toDateString();
  }

  public startsAfter(other: TimeSlot): boolean {
    return isAfter(this.start, other.start);
  }

  public endsBefore(other: TimeSlot): boolean {
    return isBefore(this.end, other.end);
  }

  public toString(): string {
    return `${this.start.toISOString()}/${this.end.toISOString()}`;
  }

  public static fromString(str: string): TimeSlot {
    const [startStr, endStr] = str.split('/');
    if (!startStr || !endStr) {
      throw new Error('Invalid TimeSlot format');
    }
    return new TimeSlot(new Date(startStr), new Date(endStr));
  }
}

export class ScheduleWeek {
  private readonly monday: Date;
  private readonly year: number;
  private readonly weekNumber: number;

  constructor(year: number, weekNumber: number) {
    if (weekNumber < 1 || weekNumber > 53) {
      throw new Error('Week number must be between 1 and 53');
    }
    this.year = year;
    this.weekNumber = weekNumber;
    this.monday = this.getMondayOfWeek(year, weekNumber);
  }

  private getMondayOfWeek(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const monday = new Date(simple);
    monday.setDate(simple.getDate() - ((dow + 6) % 7));
    return monday;
  }

  public getMonday(): Date {
    return new Date(this.monday);
  }

  public getSunday(): Date {
    const sunday = new Date(this.monday);
    sunday.setDate(sunday.getDate() + 6);
    return sunday;
  }

  public getYear(): number {
    return this.year;
  }

  public getWeekNumber(): number {
    return this.weekNumber;
  }

  public contains(date: Date): boolean {
    const weekStart = this.getMonday();
    const nextWeekStart = new Date(this.monday);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    return date >= weekStart && date < nextWeekStart;
  }

  public next(): ScheduleWeek {
    let nextWeek = this.weekNumber + 1;
    let nextYear = this.year;
    if (nextWeek > 52) {
      nextWeek = 1;
      nextYear += 1;
    }
    return new ScheduleWeek(nextYear, nextWeek);
  }

  public previous(): ScheduleWeek {
    let prevWeek = this.weekNumber - 1;
    let prevYear = this.year;
    if (prevWeek < 1) {
      prevWeek = 52;
      prevYear -= 1;
    }
    return new ScheduleWeek(prevYear, prevWeek);
  }

  public equals(other: ScheduleWeek): boolean {
    return this.year === other.year && this.weekNumber === other.weekNumber;
  }

  public toString(): string {
    return `${this.year}-W${this.weekNumber.toString().padStart(2, '0')}`;
  }

  public static fromDate(date: Date): ScheduleWeek {
    const year = date.getFullYear();
    const startOfYearDow = new Date(year, 0, 1).getDay();
    const adjustment = (startOfYearDow + 6) % 7;
    // ponytail: Date.UTC keeps every day exactly 86400000ms so this division
    // can't skew across a local DST transition; getMondayOfWeek (the anchor
    // this must match) uses local setDate() math, which is DST-safe already.
    const mondayWeek1Utc = Date.UTC(year, 0, 1 - adjustment);
    const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const days = Math.floor((dateUtc - mondayWeek1Utc) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.floor(days / 7) + 1;
    return new ScheduleWeek(year, weekNumber);
  }

  public static current(): ScheduleWeek {
    return ScheduleWeek.fromDate(new Date());
  }
}
