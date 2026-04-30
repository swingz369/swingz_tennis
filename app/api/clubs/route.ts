import { NextRequest, NextResponse } from 'next/server';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { Club as ClubEntity } from '@/domain/entities/club';
import { ValidationService } from '@/domain/services/validation.service';
import { createClubSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { createClient } from '@/infrastructure/external/supabase/server';

const clubRepo = new DrizzleClubRepository();

// Helper: Check for demo mode cookie
function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

// GET /api/clubs – Liste aller Vereine
export async function GET(req: NextRequest) {
  // Demo mode: return mock club
  if (isDemoMode(req)) {
    return NextResponse.json([
      {
        id: 'demo-club',
        name: 'Demo Tennis Club',
        status: 'active',
        memberCount: 0,
        maxMembers: 100,
      },
    ]);
  }

  try {
    const clubs = await clubRepo.findAll();
    return NextResponse.json(
      clubs.map((c) => ({
        id: c.getId().getValue(),
        name: c.getName(),
        status: c.getStatus(),
        memberCount: c.getMemberCount(),
        maxMembers: c.getMaxMembers(),
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error listing clubs:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/clubs – Verein erstellen
export async function POST(req: NextRequest) {
  // Demo mode: return created mock club
  if (isDemoMode(req)) {
    const body = await req.json();
    return NextResponse.json(
      {
        clubId: 'demo-club-' + Date.now(),
        name: body.name || 'Demo Club',
      },
      { status: 201 }
    );
  }

  return withValidation(createClubSchema, async (input) => {
    try {
      // Additional validation using domain service (provides detailed error messages)
      ValidationService.validateClubCreation(input.name, input.maxMembers, input.openingHours);

      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (!user || authError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const club = ClubEntity.create(input.name, input.maxMembers, input.openingHours);
      await clubRepo.save(club);

      // Audit log
      await AuditService.logClubCreated(user.id, club.getId().getValue(), input.name);

      return NextResponse.json(
        {
          clubId: club.getId().getValue(),
          name: club.getName(),
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating club:', error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  })(req);
}
