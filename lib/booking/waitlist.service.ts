import { createServiceClient } from '@/lib/supabase/service';
import type { WaitlistEntry, CreateWaitlistEntry, WaitlistStatus } from '../types/court-booking';

const supabase = createServiceClient();

export class WaitlistService {
  private static instance: WaitlistService;

  private constructor() {}

  public static getInstance(): WaitlistService {
    if (!WaitlistService.instance) {
      WaitlistService.instance = new WaitlistService();
    }
    return WaitlistService.instance;
  }

  async createWaitlistEntry(
    data: CreateWaitlistEntry,
    userId: string,
    clubId: string
  ): Promise<WaitlistEntry> {
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

  async getWaitlistEntriesByUser(
    userId: string,
    filters?: {
      status?: WaitlistStatus;
    }
  ): Promise<WaitlistEntry[]> {
    let query = supabase.from('waitlist_entries').select('*').eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to get waitlist entries: ${error.message}`);
    }

    return data || [];
  }

  async getWaitlistEntriesByCourt(
    courtId: string,
    filters?: {
      status?: WaitlistStatus;
    }
  ): Promise<WaitlistEntry[]> {
    let query = supabase.from('waitlist_entries').select('*').eq('court_id', courtId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to get waitlist entries: ${error.message}`);
    }

    return data || [];
  }

  async updateWaitlistStatus(
    entryId: string,
    status: WaitlistStatus,
    metadata?: {
      offered_at?: string;
      expires_at?: string;
    }
  ): Promise<WaitlistEntry> {
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

  async processWaitlist(
    courtId: string,
    startTime: string,
    endTime: string,
    checkAvailability: (courtId: string, start: string, end: string) => Promise<boolean>
  ): Promise<WaitlistEntry[]> {
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

      if (entryStart <= requestedEnd && entryEnd >= requestedStart) {
        const isAvailable = await checkAvailability(courtId, entry.start_time, entry.end_time);

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

export const waitlistService = WaitlistService.getInstance();
