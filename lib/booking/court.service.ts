import { createServiceClient } from '@/lib/supabase/service';
import type { Court, CourtType, CreateCourt, CourtStatus } from '../types/court-booking';

const supabase = createServiceClient();

export class CourtService {
  private static instance: CourtService;

  private constructor() {}

  public static getInstance(): CourtService {
    if (!CourtService.instance) {
      CourtService.instance = new CourtService();
    }
    return CourtService.instance;
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

  async getCourtsByClub(
    clubId: string,
    filters?: {
      status?: CourtStatus;
      isActive?: boolean;
    }
  ): Promise<Court[]> {
    let query = supabase.from('courts').select('*').eq('club_id', clubId);

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

  async getAllCourtTypes(): Promise<CourtType[]> {
    const { data, error } = await supabase
      .from('court_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get court types: ${error.message}`);
    }

    return data || [];
  }

  /** Paginated: active court types only (for members) */
  async getCourtTypesPaginated(
    page: number,
    limit: number
  ): Promise<{ data: CourtType[]; count: number }> {
    const offset = (page - 1) * limit;
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('court_types')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1),
      supabase
        .from('court_types')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ]);

    if (error) {
      throw new Error(`Failed to get court types: ${error.message}`);
    }

    return { data: data || [], count: count ?? 0 };
  }

  /** Paginated: all court types including inactive (for admins) */
  async getAllCourtTypesPaginated(
    page: number,
    limit: number
  ): Promise<{ data: CourtType[]; count: number }> {
    const offset = (page - 1) * limit;
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('court_types')
        .select('*')
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1),
      supabase.from('court_types').select('id', { count: 'exact', head: true }),
    ]);

    if (error) {
      throw new Error(`Failed to get court types: ${error.message}`);
    }

    return { data: data || [], count: count ?? 0 };
  }

  async createCourtType(data: {
    name: string;
    description?: string;
    surface_type: 'clay' | 'hard' | 'grass' | 'carpet' | 'artificial_grass';
    is_indoor: boolean;
    is_outdoor: boolean;
    requires_lighting: boolean;
    max_players?: number;
    hourly_rate?: number;
  }): Promise<CourtType> {
    const { data: courtType, error } = await supabase
      .from('court_types')
      .insert({
        name: data.name,
        description: data.description || null,
        surface_type: data.surface_type,
        is_indoor: data.is_indoor,
        is_outdoor: data.is_outdoor,
        requires_lighting: data.requires_lighting,
        max_players: data.max_players || 4,
        hourly_rate: data.hourly_rate || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create court type: ${error.message}`);
    }

    return courtType;
  }

  async updateCourtType(id: string, updates: Partial<CourtType>): Promise<CourtType | null> {
    const { data: courtType, error } = await supabase
      .from('court_types')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update court type:', error);
      return null;
    }

    return courtType;
  }

  async deleteCourtType(id: string): Promise<{ success: boolean; message?: string }> {
    // Soft delete: set is_active = false
    const { error } = await supabase.from('court_types').update({ is_active: false }).eq('id', id);

    if (error) {
      console.error('Failed to delete court type:', error);
      return { success: false, message: error.message };
    }

    return { success: true };
  }

  async updateCourt(courtId: string, updates: Partial<Court>): Promise<Court | null> {
    // Build update object with snake_case keys for Supabase
    const dbUpdates: Record<string, any> = {};

    if (updates.club_id !== undefined) dbUpdates.club_id = updates.club_id;
    if (updates.court_type_id !== undefined) dbUpdates.court_type_id = updates.court_type_id;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.number !== undefined) dbUpdates.number = updates.number;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.has_lighting !== undefined) dbUpdates.has_lighting = updates.has_lighting;
    if (updates.lighting_hours_start !== undefined)
      dbUpdates.lighting_hours_start = updates.lighting_hours_start;
    if (updates.lighting_hours_end !== undefined)
      dbUpdates.lighting_hours_end = updates.lighting_hours_end;
    if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active;

    // Include updated_at trigger? DB handles it.

    const { data: court, error } = await supabase
      .from('courts')
      .update(dbUpdates)
      .eq('id', courtId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update court:', error);
      return null;
    }

    return court;
  }

  async deleteCourt(courtId: string): Promise<boolean> {
    // Soft delete: set is_active = false
    const { error } = await supabase.from('courts').update({ is_active: false }).eq('id', courtId);

    if (error) {
      console.error('Failed to delete court:', error);
      return false;
    }

    return true;
  }
}

export const courtService = CourtService.getInstance();
