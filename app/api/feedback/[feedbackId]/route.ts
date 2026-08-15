import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { feedbackRepository, type Feedback } from '@/lib/repositories/feedback-repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:feedback:[feedbackId]');

/**
 * @swagger
 * /api/feedback/{feedbackId}:
 *   get:
 *     summary: Get feedback by ID
 *     tags: [Feedback]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     responses:
 *       200:
 *         description: Feedback retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feedback not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> }
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
      const { feedbackId } = await params;
      const feedback = await feedbackRepository.findByIdWithDetails(feedbackId);

      if (!feedback) {
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
      }

      // Check if user has access to this feedback
      if (feedback.club_id !== auth.clubId) {
        return forbiddenResponse('Zugriff verweigert');
      }

      return NextResponse.json(feedback);
    } catch (error) {
      log.error('Error fetching feedback:', error);
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }
  });
}

/**
 * @swagger
 * /api/feedback/{feedbackId}:
 *   patch:
 *     summary: Update feedback status
 *     tags: [Feedback]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewed, archived]
 *                 description: New status
 *     responses:
 *       200:
 *         description: Feedback updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feedback not found
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Nur Admins können den Feedback-Status ändern');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { feedbackId } = await params;
      const body = await request.json();
      const { is_visible, is_flagged, flagged_reason } = body;

      // Verify feedback exists and belongs to club
      const existing = await feedbackRepository.findById(feedbackId);
      if (!existing) {
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
      }

      if (existing.club_id !== auth.clubId) {
        return forbiddenResponse('Zugriff verweigert');
      }

      let updated: Feedback;

      if (typeof is_visible === 'boolean') {
        updated = await feedbackRepository.updateVisibility(feedbackId, is_visible);
      } else if (typeof is_flagged === 'boolean') {
        updated = await feedbackRepository.flagFeedback(feedbackId, is_flagged, flagged_reason);
      } else {
        return NextResponse.json(
          { error: 'Must provide is_visible or is_flagged' },
          { status: 400 }
        );
      }

      return NextResponse.json(updated);
    } catch (error) {
      log.error('Error updating feedback:', error);
      return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
    }
  });
}

/**
 * @swagger
 * /api/feedback/{feedbackId}:
 *   delete:
 *     summary: Delete feedback
 *     tags: [Feedback]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     responses:
 *       204:
 *         description: Feedback deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feedback not found
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> }
) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Nur Admins können Feedback löschen');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { feedbackId } = await params;
      // Verify feedback exists and belongs to club
      const existing = await feedbackRepository.findById(feedbackId);
      if (!existing) {
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
      }

      if (existing.club_id !== auth.clubId) {
        return forbiddenResponse('Zugriff verweigert');
      }

      await feedbackRepository.delete(feedbackId);

      return new NextResponse(null, { status: 204 });
    } catch (error) {
      log.error('Error deleting feedback:', error);
      return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
    }
  });
}
