import { createClient } from '@/infrastructure/external/supabase/server';

export interface Feedback {
  id: string;
  club_id: string;
  session_id: string | null;
  trainer_id: string;
  member_id: string;
  rating: number;
  teaching_quality: number | null;
  communication: number | null;
  motivation: number | null;
  punctuality: number | null;
  comment: string | null;
  is_visible: boolean | null;
  is_flagged: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateFeedbackInput {
  club_id: string;
  session_id?: string | null;
  trainer_id: string;
  member_id: string;
  rating: number;
  teaching_quality?: number | null;
  communication?: number | null;
  motivation?: number | null;
  punctuality?: number | null;
  comment?: string | null;
}

export interface FeedbackWithDetails extends Feedback {
  trainer?: {
    id: string;
  };
  member?: {
    id: string;
  };
  session?: {
    id: string;
  };
}

export class FeedbackRepository {
  /**
   * Create new feedback
   */
  async create(input: CreateFeedbackInput): Promise<Feedback> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trainer_feedback')
      .insert({
        club_id: input.club_id,
        session_id: input.session_id || null,
        trainer_id: input.trainer_id,
        member_id: input.member_id,
        rating: input.rating,
        teaching_quality: input.teaching_quality || null,
        communication: input.communication || null,
        motivation: input.motivation || null,
        punctuality: input.punctuality || null,
        comment: input.comment || null,
        is_visible: true,
        is_flagged: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get feedback by ID
   */
  async findById(id: string): Promise<Feedback | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trainer_feedback')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  /**
   * Get feedback with related details
   */
  async findByIdWithDetails(id: string): Promise<FeedbackWithDetails | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trainer_feedback')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as FeedbackWithDetails;
  }

  /**
   * Get all feedback for a club with pagination
   */
  async findByClub(
    clubId: string,
    options?: {
      limit?: number;
      offset?: number;
      visibleOnly?: boolean;
    }
  ): Promise<{ feedback: FeedbackWithDetails[]; total: number }> {
    const supabase = await createClient();
    let query = supabase
      .from('trainer_feedback')
      .select('*', { count: 'exact' })
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (options?.visibleOnly) {
      query = query.eq('is_visible', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { feedback: (data as FeedbackWithDetails[]) || [], total: count || 0 };
  }

  /**
   * Get feedback for a specific trainer
   */
  async findByTrainer(
    trainerId: string,
    options?: {
      limit?: number;
      offset?: number;
      visibleOnly?: boolean;
    }
  ): Promise<{ feedback: FeedbackWithDetails[]; total: number }> {
    const supabase = await createClient();
    let query = supabase
      .from('trainer_feedback')
      .select('*', { count: 'exact' })
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (options?.visibleOnly) {
      query = query.eq('is_visible', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { feedback: (data as FeedbackWithDetails[]) || [], total: count || 0 };
  }

  /**
   * Get trainer average rating and count
   */
  async getTrainerStats(trainerId: string): Promise<{
    averageRating: number;
    totalFeedback: number;
    ratingDistribution: { rating: number; count: number }[];
  }> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trainer_feedback')
      .select('rating')
      .eq('trainer_id', trainerId)
      .eq('is_visible', true);

    if (error) throw error;

    const ratings = data || [];
    const totalFeedback = ratings.length;

    if (totalFeedback === 0) {
      return {
        averageRating: 0,
        totalFeedback: 0,
        ratingDistribution: [],
      };
    }

    const sum = ratings.reduce((acc, f) => acc + f.rating, 0);
    const averageRating = sum / totalFeedback;

    // Calculate distribution
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((f) => {
      distribution[f.rating] = (distribution[f.rating] || 0) + 1;
    });

    const ratingDistribution = Object.entries(distribution).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
    }));

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalFeedback,
      ratingDistribution,
    };
  }

  /**
   * Update feedback visibility
   */
  async updateVisibility(id: string, isVisible: boolean): Promise<Feedback> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trainer_feedback')
      .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Flag feedback for moderation
   */
  async flagFeedback(id: string, isFlagged: boolean, reason?: string): Promise<Feedback> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trainer_feedback')
      .update({
        is_flagged: isFlagged,
        flagged_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete feedback
   */
  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('trainer_feedback').delete().eq('id', id);

    if (error) throw error;
  }

  /**
   * Check if member has already submitted feedback for a session
   */
  async hasMemberSubmittedFeedback(sessionId: string, memberId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('trainer_feedback')
      .select('id')
      .eq('session_id', sessionId)
      .eq('member_id', memberId)
      .limit(1);

    if (error) throw error;
    return (data?.length || 0) > 0;
  }
}

export const feedbackRepository = new FeedbackRepository();
