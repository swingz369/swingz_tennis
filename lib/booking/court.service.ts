import { createServiceClient } from '@/lib/supabase/service';
import type { CourtType } from '../types/court-booking';

import { createLogger } from '@/lib/logger';

const log = createLogger('booking:court.service');

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

  // Alle court_types-Queries filtern auf club_id: die Tabelle ist mandantengetrennt,
  // dieser Service läuft aber über den Service-Client und umgeht RLS — der Filter im
  // Code ist hier die einzige Trennung zwischen den Vereinen.
  /** Paginated: active court types only (for members) */
  async getCourtTypesPaginated(
    clubId: string,
    page: number,
    limit: number
  ): Promise<{ data: CourtType[]; count: number }> {
    const offset = (page - 1) * limit;
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('court_types')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1),
      supabase
        .from('court_types')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true),
    ]);

    if (error) {
      throw new Error(`Failed to get court types: ${error.message}`);
    }

    return { data: data || [], count: count ?? 0 };
  }

  /** Paginated: all court types including inactive (for admins) */
  async getAllCourtTypesPaginated(
    clubId: string,
    page: number,
    limit: number
  ): Promise<{ data: CourtType[]; count: number }> {
    const offset = (page - 1) * limit;
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('court_types')
        .select('*')
        .eq('club_id', clubId)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1),
      supabase
        .from('court_types')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId),
    ]);

    if (error) {
      throw new Error(`Failed to get court types: ${error.message}`);
    }

    return { data: data || [], count: count ?? 0 };
  }

  async createCourtType(
    clubId: string,
    data: {
      name: string;
      description?: string;
      surface_type: 'clay' | 'hard' | 'grass' | 'carpet' | 'artificial_grass';
      is_indoor: boolean;
      is_outdoor: boolean;
      requires_lighting: boolean;
      max_players?: number;
      hourly_rate?: number;
    }
  ): Promise<CourtType> {
    const { data: courtType, error } = await supabase
      .from('court_types')
      .insert({
        club_id: clubId,
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

  async updateCourtType(
    id: string,
    clubId: string,
    updates: Partial<CourtType>
  ): Promise<CourtType | null> {
    const { data: courtType, error } = await supabase
      .from('court_types')
      .update(updates)
      .eq('id', id)
      .eq('club_id', clubId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update court type:', error);
      return null;
    }

    return courtType;
  }

  async deleteCourtType(
    id: string,
    clubId: string
  ): Promise<{ success: boolean; message?: string }> {
    // Soft delete: set is_active = false
    const { error } = await supabase
      .from('court_types')
      .update({ is_active: false })
      .eq('id', id)
      .eq('club_id', clubId);

    if (error) {
      log.error('Failed to delete court type:', error);
      return { success: false, message: error.message };
    }

    return { success: true };
  }
}

export const courtService = CourtService.getInstance();
