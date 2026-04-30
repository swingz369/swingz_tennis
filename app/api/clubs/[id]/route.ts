import { NextRequest, NextResponse } from 'next/server';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { ClubId } from '@/domain/value-objects';
import { updateClubSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { createClient } from '@/infrastructure/external/supabase/server';

const clubRepo = new DrizzleClubRepository();

// GET /api/clubs/:id – Einzelnen Verein holen
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const club = await clubRepo.findById(ClubId.fromString(id));
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: club.getId().getValue(),
      name: club.getName(),
      maxMembers: club.getMaxMembers(),
      openingHours: club.getOpeningHours(),
      status: club.getStatus(),
      memberCount: club.getMemberCount(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting club:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/clubs/:id – Verein aktualisieren
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withValidation(updateClubSchema, async (input) => {
    try {
      const clubId = ClubId.fromString(id);
      const existing = await clubRepo.findById(clubId);
      if (!existing) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }

      // Apply updates to entity
      if (input.name !== undefined) {
        existing.setName(input.name);
      }
      if (input.maxMembers !== undefined) {
        existing.setMaxMembers(input.maxMembers);
      }
      if (input.openingHours !== undefined) {
        existing.setOpeningHours(input.openingHours);
      }
      if (input.status !== undefined) {
        existing.setStatus(input.status);
      }

      // Persist changes
      await clubRepo.save(existing);

      // Audit log
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await AuditService.logClubUpdated(user.id, id, input);
        }
      } catch (auditError) {
        console.warn('Failed to record audit log:', auditError);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating club:', error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  })(req);
}
