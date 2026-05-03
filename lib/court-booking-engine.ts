import { createClient } from '@supabase/supabase-js';
import {
  Court,
  CourtType,
  Booking,
  BookingRule,
  WaitlistEntry,
  CourtAvailability,
  CreateCourt,
  CreateBooking,
  CreateWaitlistEntry,
  CreateBookingRule,
  UpdateBooking,
  BookingStatus,
  BookingType,
  WaitlistStatus,
  CourtStatus,
  TimeSlot,
  DayAvailability,
  CourtSchedule,
  BookingConflict,
} from './types/court-booking';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class CourtBookingEngine {
  private static instance: CourtBookingEngine;

  private constructor() {}

  public static getInstance(): CourtBookingEngine {
    if (!CourtBookingEngine.instance) {
      CourtBookingEngine.instance = new CourtBookingEngine();
    }
    return CourtBookingEngine.instance;
  }

  async generateBookingNumber(clubId: string): Promise<string> {
    const { data, error } = await supabase.rpc('generate_booking_number', {
      p_club_id: clubId,
    });

    if (error) {
      throw new Error(`Failed to generate booking number: ${error.message}`);
    }

    return data;
  }

  async createCourt(data: CreateCourt): Promise<Court> {
    const { data: court, error } = await supabase
      .from('courts')
      .insert({
        club_id: data.club_id,
        court_type_id: data.court_type_id,
        name: data.name,
        number: data.number,
        location: data.location,
        description: data.description,
        has_lighting: data.has_lighting,
        lighting_hours_start: data.lighting_hours_start,
        lighting_hours_end: data.lighting_hours_end,
        status: 'available',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create court: ${error.message}`);
    }

    return court;
  }

  async getCourtById(courtId: string): Promise<Court | null> {
    const { data: court, error } = await supabase
      .from('courts')
      .select('*')
      .eq('id', courtId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get court: ${error.message}`);
    }

    return court;
  }

  async getCourtsByClub(clubId: string, filters?: {
    status?: CourtStatus;
    isActive?: boolean;
  }): Promise<Court[]> {
    let query = supabase
      .from('courts')
      .select('*')
      .eq('club_id', clubId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data, error } = await query.order('number', { ascending: true });

    if (error) {
      throw new Error(`Failed to get courts: ${error.message}`);
    }

    return data || [];
  }

  async updateCourtStatus(courtId: string, status: CourtStatus): Promise<Court> {
    const { data, error } = await supabase
      .from('courts')
      .update({ status })
      .eq('id', courtId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update court status: ${error.message}`);
    }

    return data;
  }

  async getCourtTypes(): Promise<CourtType[]> {
    const { data, error } = await supabase
      .from('court_types')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get court types: ${error.message}`);
    }

    return data || [];
  }

  async createBooking(data: CreateBooking, userId: string, clubId: string): Promise<Booking> {
    const bookingNumber = await this.generateBookingNumber(clubId);

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        club_id: clubId,
        court_id: data.court_id,
        user_id: userId,
        booking_number,
        start_time: data.start_time,
        end_time: data.end_time,
        status: 'confirmed',
        booking_type: data.booking_type,
        is_recurring: data.is_recurring,
        recurring_pattern: data.recurring_pattern,
        number_of_players: data.number_of_players,
        notes: data.notes,
        payment_status: 'unpaid',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create booking: ${error.message}`);
    }

    return booking;
  }

  async getBookingById(bookingId: string): Promise<Booking | null> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get booking: ${error.message}`);
    }

    return booking;
  }

  async getBookingsByUser(userId: string, filters?: {
    status?: BookingStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<Booking[]> {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('start_time', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('end_time', filters.endDate);
    }

    const { data, error } = await query.order('start_time', { ascending: false });

    if (error) {
      throw new Error(`Failed to get bookings: ${error.message}`);
    }

    return data || [];
  }

  async getBookingsByCourt(courtId: string, filters?: {
    status?: BookingStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<Booking[]> {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('court_id', courtId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('start_time', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('end_time', filters.endDate);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to get bookings: ${error.message}`);
    }

    return data || [];
  }

  async updateBookingStatus(bookingId: string, status: BookingStatus, metadata?: {
    cancelled_at?: string;
    cancellation_reason?: string;
  }): Promise<Booking> {
    const updateData: {
      status: BookingStatus;
      cancelled_at?: string;
      cancellation_reason?: string;
    } = { status };

    if (status === 'cancelled') {
      updateData.cancelled_at = metadata?.cancelled_at || new Date().toISOString();
      updateData.cancellation_reason = metadata?.cancellation_reason;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update booking status: ${error.message}`);
    }

    return data;
  }

  async checkBookingAvailability(
    courtId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('validate_booking_availability', {
      p_court_id: courtId,
      p_start_time: startTime,
      p_end_time: endTime,
      p_exclude_booking_id: excludeBookingId || null,
    });

    if (error) {
      throw new Error(`Failed to check booking availability: ${error.message}`);
    }

    return data;
  }

  async getBookingConflicts(
    courtId: string,
    startTime: string,
    endTime: string
  ): Promise<BookingConflict[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('court_id', courtId)
      .in('status', ['confirmed', 'pending'])
      .or(`start_time < ${endTime} AND end_time > ${startTime}`);

    if (error) {
      throw new Error(`Failed to get booking conflicts: ${error.message}`);
    }

    return data || [];
  }

  async createWaitlistEntry(data: CreateWaitlistEntry, userId: string, clubId: string): Promise<WaitlistEntry> {
    const { data: entry, error } = await supabase
      .from('waitlist_entries')
      .insert({
        club_id: clubId,
        court_id: data.court_id,
        user_id: userId,
        start_time: data.start_time,
        end_time: data.end_time,
        number_of_players: data.number_of_players,
        priority: data.priority,
        notes: data.notes,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create waitlist entry: ${error.message}`);
    }

    return entry;
  }

  async getWaitlistEntriesByUser(userId: string, filters?: {
    status?: WaitlistStatus;
  }): Promise<WaitlistEntry[]> {
    let query = supabase
      .from('waitlist_entries')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to get waitlist entries: ${error.message}`);
    }

    return data || [];
  }

  async getWaitlistEntriesByCourt(courtId: string, filters?: {
    status?: WaitlistStatus;
  }): Promise<WaitlistEntry[]> {
    let query = supabase
      .from('waitlist_entries')
      .select('*')
      .eq('court_id', courtId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to get waitlist entries: ${error.message}`);
    }

    return data || [];
  }

  async updateWaitlistStatus(entryId: string, status: WaitlistStatus, metadata?: {
    offered_at?: string;
    expires_at?: string;
  }): Promise<WaitlistEntry> {
    const updateData: {
      status: WaitlistStatus;
      offered_at?: string;
      expires_at?: string;
    } = { status };

    if (metadata?.offered_at) {
      updateData.offered_at = metadata.offered_at;
    }

    if (metadata?.expires_at) {
      updateData.expires_at = metadata.expires_at;
    }

    const { data, error } = await supabase
      .from('waitlist_entries')
      .update(updateData)
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update waitlist status: ${error.message}`);
    }

    return data;
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

  async getCourtAvailability(courtId: string, startDate: string, endDate: string): Promise<CourtAvailability[]> {
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

    const bookings = await this.getBookingsByCourt(courtId, {
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

  async getCourtSchedule(courtId: string, startDate: string, endDate: string): Promise<CourtSchedule> {
    const court = await this.getCourtById(courtId);
    if (!court) {
      throw new Error('Court not found');
    }

    const { data: courtType } = await supabase
      .from('court_types')
      .select('*')
      .eq('id', court.court_type_id)
      .single();

    const days: DayAvailability[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    while (start <= end) {
      const dateStr = start.toISOString().split('T')[0];
      const dayAvailability = await this.getDayAvailability(courtId, dateStr);
      days.push(dayAvailability);
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

    const advanceDays = Math.floor((bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (advanceDays > rule.advance_booking_days) {
      errors.push(`Vorausbuchung ist nur ${rule.advance_booking_days} Tage im Voraus möglich`);
    }

    const dayStart = new Date(bookingStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayBookings = await this.getBookingsByUser(userId, {
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

    const weekBookings = await this.getBookingsByUser(userId, {
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

  async processWaitlist(courtId: string, startTime: string, endTime: string): Promise<WaitlistEntry[]> {
    const { data: entries, error } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('court_id', courtId)
      .eq('status', 'waiting')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get waitlist entries: ${error.message}`);
    }

    const processed: WaitlistEntry[] = [];

    for (const entry of entries || []) {
      const entryStart = new Date(entry.start_time);
      const entryEnd = new Date(entry.end_time);
      const requestedStart = new Date(startTime);
      const requestedEnd = new Date(endTime);

      if (
        entryStart <= requestedEnd &&
        entryEnd >= requestedStart
      ) {
        const isAvailable = await this.checkBookingAvailability(courtId, entry.start_time, entry.end_time);

        if (isAvailable) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          const updated = await this.updateWaitlistStatus(entry.id, 'offered', {
            offered_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          });

          processed.push(updated);
        }
      }
    }

    return processed;
  }
}

export const courtBookingEngine = CourtBookingEngine.getInstance();
