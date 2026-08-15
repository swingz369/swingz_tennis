import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { feedbackRepository } from '@/lib/repositories/feedback-repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:feedback');

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Create new feedback
 *     tags: [Feedback]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trainer_id
 *               - rating
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: Optional session ID
 *               trainer_id:
 *                 type: string
 *                 description: Trainer ID
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *               comment:
 *                 type: string
 *                 description: Optional feedback comment
 *     responses:
 *       201:
 *         description: Feedback created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Validate club context
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 });
    }

    const clubId = auth.clubId!;

    try {
      const body = await request.json();
      const { session_id, trainer_id, rating, comment } = body;

      // Validate required fields
      if (!trainer_id) {
        return NextResponse.json({ error: 'trainer_id is required' }, { status: 400 });
      }

      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
      }

      // Check if member has already submitted feedback for this session
      if (session_id) {
        const hasSubmitted = await feedbackRepository.hasMemberSubmittedFeedback(
          session_id,
          auth.user.id
        );

        if (hasSubmitted) {
          return NextResponse.json(
            { error: 'Feedback already submitted for this session' },
            { status: 400 }
          );
        }
      }

      // Create feedback
      const feedback = await feedbackRepository.create({
        club_id: clubId,
        session_id: session_id || null,
        trainer_id,
        member_id: auth.user.id,
        rating: parseInt(rating),
        comment: comment || null,
      });

      return NextResponse.json(feedback, { status: 201 });
    } catch (error) {
      log.error('Error creating feedback:', error);
      return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 });
    }
  });
}

/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Get all feedback for the tenant
 *     tags: [Feedback]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, archived]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Feedback list retrieved successfully
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Validate club context
    if (!auth.clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 });
    }

    const clubId = auth.clubId!;

    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');
      const visibleOnly = searchParams.get('visibleOnly') !== 'false';

      const result = await feedbackRepository.findByClub(clubId, {
        limit,
        offset,
        visibleOnly,
      });

      return NextResponse.json({
        feedback: result.feedback,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      log.error('Error fetching feedback:', error);
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }
  });
}
