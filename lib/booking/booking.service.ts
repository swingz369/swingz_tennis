import { createServiceClient } from '@/lib/supabase/service';
import type { Booking, BookingStatus, BookingConflict } from '../types/court-booking';

const supabase = createServiceClient();

export class BookingService {
  private static instance: BookingService;

  private constructor() {}

  public static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService();
    }
    return BookingService.instance;
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

  async getBookingsByUser(
    userId: string,
    filters?: {
      status?: BookingStatus;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Booking[]> {
    let query = supabase.from('bookings').select('*').eq('user_id', userId);

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

  async getBookingsByCourt(
    courtId: string,
    filters?: {
      status?: BookingStatus;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Booking[]> {
    let query = supabase.from('bookings').select('*').eq('court_id', courtId);

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

  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    metadata?: {
      cancelled_at?: string;
      cancellation_reason?: string;
    }
  ): Promise<Booking> {
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
}

export const bookingService = BookingService.getInstance();
