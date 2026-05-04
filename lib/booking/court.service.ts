import { createClient } from '@supabase/supabase-js';
import { Court, CourtType, CreateCourt, CourtStatus } from '../types/court-booking';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
}

export const courtService = CourtService.getInstance();
