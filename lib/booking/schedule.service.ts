import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type {
  BookingRule,
  CreateBookingRule,
  CourtAvailability,
  TimeSlot,
  DayAvailability,
  CourtSchedule,
} from '../types/court-booking';
import { BookingService } from './booking.service';
import { CourtService } from './court.service';

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export class ScheduleService {
  private static instance: ScheduleService;
  private bookingService = BookingService.getInstance();
  private courtService = CourtService.getInstance();

  private constructor() {}

  public static getInstance(): ScheduleService {
    if (!ScheduleService.instance) {
      ScheduleService.instance = new ScheduleService();
    }
    return ScheduleService.instance;
  }

  async getCourtAvailability(
    courtId: string,
    startDate: string,
    endDate: string
  ): Promise<CourtAvailability[]> {
    const { data, error } = await supabase.rpc('get_court_availability', {
      p_court_id: courtId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      throw new Error(`Failed to get court availability: ${error.message}`);
    }

    return data || [];
  }

  async getAvailableTimeSlots(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string,
    slotDurationMinutes: number = 30
  ): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    const bookings = await this.bookingService.getBookingsByCourt(courtId, {
      status: 'confirmed',
      startDate: `${date}T00:00:00`,
      endDate: `${date}T23:59:59`,
    });

    let currentSlotStart = new Date(start);
    while (currentSlotStart < end) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMinutes * 60000);

      if (currentSlotEnd > end) {
        break;
      }

      const isAvailable = !bookings.some(
        (booking) =>
          new Date(booking.start_time) < currentSlotEnd &&
          new Date(booking.end_time) > currentSlotStart
      );

      slots.push({
        start_time: currentSlotStart.toTimeString().slice(0, 5),
        end_time: currentSlotEnd.toTimeString().slice(0, 5),
        is_available: isAvailable,
      });

      currentSlotStart = currentSlotEnd;
    }

    return slots;
  }

  async getDayAvailability(courtId: string, date: string): Promise<DayAvailability> {
    const dayOfWeek = new Date(date).getDay();
    const { data: availability, error } = await supabase
      .from('court_availability')
      .select('*')
      .eq('court_id', courtId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true)
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to get day availability: ${error.message}`);
    }

    const timeSlots: TimeSlot[] = [];

    for (const avail of availability || []) {
      const slots = await this.getAvailableTimeSlots(
        courtId,
        date,
        avail.start_time,
        avail.end_time
      );
      timeSlots.push(...slots);
    }

    return {
      date,
      day_of_week: dayOfWeek,
      time_slots: timeSlots,
    };
  }

  async getCourtSchedule(
    courtId: string,
    startDate: string,
    endDate: string
  ): Promise<CourtSchedule> {
    const court = await this.courtService.getCourtById(courtId);
    if (!court) {
      throw new Error('Court not found');
    }

    // Batch: fetch court type, availability rules, and all bookings for the
    // full date range in parallel — 3 queries instead of 7+ sequential ones.
    const [courtTypeResult, availabilityResult, bookingsResult] = await Promise.all([
      supabase.from('court_types').select('*').eq('id', court.court_type_id).single(),
      supabase
        .from('court_availability')
        .select('*')
        .eq('court_id', courtId)
        .eq('is_available', true)
        .order('start_time', { ascending: true }),
      supabase
        .from('bookings')
        .select('id, start_time, end_time, status')
        .eq('court_id', courtId)
        .in('status', ['confirmed', 'pending'])
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`),
    ]);

    const courtType = courtTypeResult.data;
    const availabilityRules = availabilityResult.data ?? [];
    // Group bookings by date string (YYYY-MM-DD) for O(1) lookup per day
    const bookingsByDate = new Map<string, typeof bookingsResult.data>();
    for (const b of bookingsResult.data ?? []) {
      const d = b.start_time.substring(0, 10);
      if (!bookingsByDate.has(d)) bookingsByDate.set(d, []);
      bookingsByDate.get(d)!.push(b);
    }

    const days: DayAvailability[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    while (start <= end) {
      const dateStr = start.toISOString().split('T')[0];
      const dayOfWeek = start.getDay();
      const dayBookings = bookingsByDate.get(dateStr) ?? [];

      const timeSlots: TimeSlot[] = [];
      for (const avail of availabilityRules.filter((a) => a.day_of_week === dayOfWeek)) {
        const slotStart = new Date(`${dateStr}T${avail.start_time}`);
        const slotEnd = new Date(`${dateStr}T${avail.end_time}`);
        const slotDurationMinutes = 30;
        let cur = new Date(slotStart);

        while (cur < slotEnd) {
          const next = new Date(cur.getTime() + slotDurationMinutes * 60_000);
          if (next > slotEnd) break;

          const isAvailable = !dayBookings.some(
            (b) => new Date(b.start_time) < next && new Date(b.end_time) > cur
          );

          timeSlots.push({
            start_time: cur.toTimeString().slice(0, 5),
            end_time: next.toTimeString().slice(0, 5),
            is_available: isAvailable,
          });

          cur = next;
        }
      }

      days.push({ date: dateStr, day_of_week: dayOfWeek, time_slots: timeSlots });
      start.setDate(start.getDate() + 1);
    }

    return {
      court_id: court.id,
      court_name: court.name,
      court_type: courtType,
      days,
    };
  }

  async validateBookingRules(
    userId: string,
    clubId: string,
    startTime: string,
    endTime: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const rule = await this.getBookingRule(clubId);

    if (!rule) {
      return { valid: true, errors: [] };
    }

    const bookingStart = new Date(startTime);
    const bookingEnd = new Date(endTime);
    const now = new Date();
    const durationMinutes = (bookingEnd.getTime() - bookingStart.getTime()) / 60000;

    if (durationMinutes > rule.max_booking_duration_minutes) {
      errors.push(`Maximale Buchungsdauer ist ${rule.max_booking_duration_minutes} Minuten`);
    }

    if (durationMinutes < rule.min_booking_duration_minutes) {
      errors.push(`Minimale Buchungsdauer ist ${rule.min_booking_duration_minutes} Minuten`);
    }

    const advanceDays = Math.floor(
      (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (advanceDays > rule.advance_booking_days) {
      errors.push(`Vorausbuchung ist nur ${rule.advance_booking_days} Tage im Voraus möglich`);
    }

    const dayStart = new Date(bookingStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayBookings = await this.bookingService.getBookingsByUser(userId, {
      startDate: dayStart.toISOString(),
      endDate: dayEnd.toISOString(),
      status: 'confirmed',
    });

    if (dayBookings.length >= rule.max_bookings_per_day) {
      errors.push(`Maximal ${rule.max_bookings_per_day} Buchungen pro Tag erlaubt`);
    }

    const weekStart = new Date(bookingStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekBookings = await this.bookingService.getBookingsByUser(userId, {
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      status: 'confirmed',
    });

    if (weekBookings.length >= rule.max_bookings_per_week) {
      errors.push(`Maximal ${rule.max_bookings_per_week} Buchungen pro Woche erlaubt`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getBookingRule(clubId: string): Promise<BookingRule | null> {
    const { data, error } = await supabase
      .from('booking_rules')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get booking rule: ${error.message}`);
    }

    return data;
  }

  async createBookingRule(data: CreateBookingRule): Promise<BookingRule> {
    const { data: rule, error } = await supabase
      .from('booking_rules')
      .insert({
        ...data,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create booking rule: ${error.message}`);
    }

    return rule;
  }
}

export const scheduleService = ScheduleService.getInstance();
