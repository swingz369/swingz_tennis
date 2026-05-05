import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { courtService } from '@/lib/booking/court.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

// GET /api/courts/[id] – Einzelnen Court abrufen
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const courtId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(courtId)) {
      return NextResponse.json({ error: 'Invalid court ID format' }, { status: 400 });
    }

    try {
      const court = await courtService.getCourtById(courtId);

      if (!court) {
        return NextResponse.json({ error: 'Court not found' }, { status: 404 });
      }

      // Check club membership (superadmin can access any)
      if (auth.role !== 'superadmin' && court.club_id !== auth.clubId) {
        return forbiddenResponse('Cannot access court from different club');
      }

      return NextResponse.json({
        id: court.id,
        clubId: court.club_id,
        courtTypeId: court.court_type_id,
        name: court.name,
        number: court.number,
        surface: court.surface,
        location: court.location,
        description: court.description,
        status: court.status,
        hasLighting: court.has_lighting,
        lightingHoursStart: court.lighting_hours_start,
        lightingHoursEnd: court.lighting_hours_end,
        isActive: court.is_active,
        createdAt: court.created_at,
        updatedAt: court.updated_at,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching court:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// PATCH /api/courts/[id] – Court aktualisieren
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const courtId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(courtId)) {
      return NextResponse.json({ error: 'Invalid court ID format' }, { status: 400 });
    }

    try {
      const body = await req.json();
      const {
        name,
        courtTypeId,
        number,
        surface,
        hasLighting,
        lightingHoursStart,
        lightingHoursEnd,
        location,
        description,
        status,
        isActive,
        clubId: bodyClubId,
      } = body;

      // Fetch existing court
      const existingCourt = await courtService.getCourtById(courtId);
      if (!existingCourt) {
        return NextResponse.json({ error: 'Court not found' }, { status: 404 });
      }

      // SECURITY: Validate club membership for non-superadmin
      if (auth.role !== 'superadmin' && existingCourt.club_id !== auth.clubId) {
        return forbiddenResponse('Cannot update court from different club');
      }

      // Build update object (snake_case for service)
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (courtTypeId !== undefined) updates.court_type_id = courtTypeId;
      if (number !== undefined) updates.number = number;
      if (surface !== undefined) updates.surface = surface;
      if (hasLighting !== undefined) updates.has_lighting = hasLighting;
      if (lightingHoursStart !== undefined) updates.lighting_hours_start = lightingHoursStart;
      if (lightingHoursEnd !== undefined) updates.lighting_hours_end = lightingHoursEnd;
      if (location !== undefined) updates.location = location;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (isActive !== undefined) updates.is_active = isActive;

      // SECURITY: Disallow clubId changes via PATCH for non-superadmin (and generally)
      if (bodyClubId !== undefined && auth.role !== 'superadmin') {
        return NextResponse.json({ error: 'Cannot change clubId' }, { status: 403 });
      }

      // Call service update
      const updatedCourt = await courtService.updateCourt(courtId, updates);

      if (!updatedCourt) {
        return NextResponse.json({ error: 'Failed to update court' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        court: {
          id: updatedCourt.id,
          clubId: updatedCourt.club_id,
          courtTypeId: updatedCourt.court_type_id,
          name: updatedCourt.name,
          number: updatedCourt.number,
          surface: updatedCourt.surface,
          location: updatedCourt.location,
          description: updatedCourt.description,
          status: updatedCourt.status,
          hasLighting: updatedCourt.has_lighting,
          lightingHoursStart: updatedCourt.lighting_hours_start,
          lightingHoursEnd: updatedCourt.lighting_hours_end,
          isActive: updatedCourt.is_active,
          updatedAt: updatedCourt.updated_at,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating court:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// DELETE /api/courts/[id] – Court löschen (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const courtId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(courtId)) {
      return NextResponse.json({ error: 'Invalid court ID format' }, { status: 400 });
    }

    try {
      const court = await courtService.getCourtById(courtId);
      if (!court) {
        return NextResponse.json({ error: 'Court not found' }, { status: 404 });
      }

      // Check club membership
      if (auth.role !== 'superadmin' && court.club_id !== auth.clubId) {
        return forbiddenResponse('Cannot delete court from different club');
      }

      // Soft delete: set is_active = false via update
      const success = await courtService.deleteCourt(courtId);
      if (!success) {
        return NextResponse.json({ error: 'Failed to delete court' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Court deactivated' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting court:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
