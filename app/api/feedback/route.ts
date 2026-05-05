import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { z } from 'zod';

const createFeedbackSchema = z.object({
  trainerId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  teachingQuality: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  motivation: z.number().int().min(1).max(5).optional(),
  punctuality: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

// GET /api/feedback - List feedback
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    // Members can view feedback
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const trainerId = url.searchParams.get('trainerId');
    const clubId = url.searchParams.get('clubId');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!trainerId && !clubId) {
      return NextResponse.json({ error: 'trainerId or clubId required' }, { status: 400 });
    }

    try {
      const supabase = await createClient();

      let query = supabase
        .from('trainer_feedback')
        .select(
          `
          id,
          trainer_id,
          member_id,
          session_id,
          rating,
          teaching_quality,
          communication,
          motivation,
          punctuality,
          comment,
          created_at
        `
        )
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (trainerId) {
        query = query.eq('trainer_id', trainerId);
      }
      if (clubId) {
        query = query.eq('club_id', clubId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch feedback:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching feedback:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// POST /api/feedback - Create feedback
export async function POST(req: NextRequest) {
  return withCSRFProtection(req, async () => {
    return withApiAuth(req, async (auth) => {
      // Only members can create feedback
      const hasPermission = await verifyRole(auth, 'member');
      if (!hasPermission) {
        return forbiddenResponse('Member access required');
      }

      const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
      if (rateLimitError) return rateLimitError;

      try {
        const body = await req.json();
        const validation = createFeedbackSchema.safeParse(body);

        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid input', details: validation.error.issues },
            { status: 400 }
          );
        }

        const {
          trainerId,
          sessionId,
          rating,
          teachingQuality,
          communication,
          motivation,
          punctuality,
          comment,
        } = validation.data;

        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get member's club
        const { data: membership } = await supabase
          .from('user_club_memberships')
          .select('club_id')
          .eq('user_id', user.id)
          .eq('role', 'member')
          .single();

        if (!membership) {
          return forbiddenResponse('Member membership required');
        }

        // Verify trainer belongs to same club
        const { data: trainerMembership } = await supabase
          .from('user_club_memberships')
          .select('club_id')
          .eq('user_id', trainerId)
          .eq('club_id', membership.club_id)
          .single();

        if (!trainerMembership) {
          return NextResponse.json({ error: 'Trainer not found in your club' }, { status: 404 });
        }

        // If sessionId provided, verify member was booked for that session
        if (sessionId) {
          const { data: booking } = await supabase
            .from('bookings')
            .select('id')
            .eq('session_id', sessionId)
            .eq('member_id', user.id)
            .eq('status', 'completed')
            .single();

          if (!booking) {
            return NextResponse.json(
              { error: 'You must complete the session before providing feedback' },
              { status: 403 }
            );
          }

          // Check if feedback already exists for this session
          const { data: existingFeedback } = await supabase
            .from('trainer_feedback')
            .select('id')
            .eq('member_id', user.id)
            .eq('session_id', sessionId)
            .single();

          if (existingFeedback) {
            return NextResponse.json(
              { error: 'Feedback already submitted for this session' },
              { status: 409 }
            );
          }
        }

        // Create feedback
        const { data: feedback, error } = await supabase
          .from('trainer_feedback')
          .insert({
            member_id: user.id,
            trainer_id: trainerId,
            session_id: sessionId || null,
            club_id: membership.club_id,
            rating,
            teaching_quality: teachingQuality || null,
            communication: communication || null,
            motivation: motivation || null,
            punctuality: punctuality || null,
            comment: comment || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to create feedback:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(feedback, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error creating feedback:', error);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    });
  });
}
