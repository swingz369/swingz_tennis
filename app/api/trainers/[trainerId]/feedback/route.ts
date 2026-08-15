import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { feedbackRepository } from '@/lib/repositories/feedback-repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainers:[trainerId]:feedback');

/**
 * @swagger
 * /api/trainers/{trainerId}/feedback:
 *   get:
 *     summary: Get feedback for a specific trainer
 *     tags: [Feedback]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: trainerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Trainer ID
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
 *         description: Trainer feedback retrieved successfully
 *       401:
 *         description: Unauthorized
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { trainerId } = await params;
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');
      const visibleOnly = searchParams.get('visibleOnly') !== 'false';

      const result = await feedbackRepository.findByTrainer(trainerId, {
        limit,
        offset,
        visibleOnly,
      });

      // Also get trainer stats
      const stats = await feedbackRepository.getTrainerStats(trainerId);

      return NextResponse.json({
        feedback: result.feedback,
        total: result.total,
        limit,
        offset,
        stats,
      });
    } catch (error) {
      log.error('Error fetching trainer feedback:', error);
      return NextResponse.json(
        { error: 'Trainer-Feedback konnte nicht geladen werden' },
        { status: 500 }
      );
    }
  });
}
