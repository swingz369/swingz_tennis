import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { feedbackRepository, type Feedback } from '@/lib/repositories/feedback-repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

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
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(request, rateLimit);
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
        return forbiddenResponse('Access denied');
      }

      return NextResponse.json(feedback);
    } catch (error) {
      console.error('Error fetching feedback:', error);
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
      return forbiddenResponse('Only admins can update feedback status');
    }

    const rateLimitError = await checkRateLimitOrFail(request, rateLimit);
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
        return forbiddenResponse('Access denied');
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
      console.error('Error updating feedback:', error);
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
      return forbiddenResponse('Only admins can delete feedback');
    }

    const rateLimitError = await checkRateLimitOrFail(request, rateLimit);
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
        return forbiddenResponse('Access denied');
      }

      await feedbackRepository.delete(feedbackId);

      return new NextResponse(null, { status: 204 });
    } catch (error) {
      console.error('Error deleting feedback:', error);
      return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
    }
  });
}
